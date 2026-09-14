import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { ConnectorResponseReceivedEvent } from '@veerox/events';
import { ProcessConnectorResponseHandler } from '../../application/handlers/process-connector-response.handler';

@Controller()
export class ConnectorResponseController {
  private readonly logger = new Logger(ConnectorResponseController.name);

  constructor(private readonly processConnectorResponseHandler: ProcessConnectorResponseHandler) {}

  @EventPattern('ConnectorResponseReceivedEvent')
  async handleConnectorResponse(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      // NestJS Microservices might wrap the payload or send it directly.
      let payload = data;
      if (data && data.value) {
        payload = data.value;
      }
      
      const receivedAt = payload.receivedAt ? new Date(payload.receivedAt) : new Date();
      
      const event = new ConnectorResponseReceivedEvent(
        payload.responseId,
        payload.commandId,
        payload.connectorId,
        payload.responseCode,
        payload.responseMessage,
        payload.payloadJson,
        receivedAt
      );

      // We await the handler directly to ensure processing is complete and durable
      await this.processConnectorResponseHandler.handle(event);

      // Manually ACK upon success
      channel.ack(originalMsg);
    } catch (error: any) {
      this.logger.error(`Failed to process ConnectorResponseReceivedEvent: ${error.message}`, error?.stack);
      
      const isTransient = this.isTransientError(error);
      const headers = originalMsg.properties.headers || {};
      const rawRetryCount = Number(headers['x-retry-count']);
      const retryCount = isNaN(rawRetryCount) ? 0 : Math.max(0, rawRetryCount);
      const MAX_RETRIES = 5;

      if (isTransient && retryCount < MAX_RETRIES) {
        this.logger.warn(`Transient error encountered. Retrying message (attempt ${retryCount + 1} of ${MAX_RETRIES}).`);
        
        try {
          const connection = channel.connection;
          const confirmChannel = await connection.createConfirmChannel();
          
          try {
            await new Promise<void>((resolve, reject) => {
              confirmChannel.sendToQueue('execution_retry_queue', originalMsg.content, {
                headers: {
                  ...headers,
                  'x-retry-count': retryCount + 1
                }
              }, (err: any) => {
                if (err) reject(err);
                else resolve();
              });
            });
            
            // ACK original message only after successful republish
            channel.ack(originalMsg);
          } finally {
            // Guarantee channel closure regardless of success/failure
            await confirmChannel.close();
          }
        } catch (publishError: any) {
          this.logger.error(`Failed to republish message to retry queue: ${publishError.message}`);
          // Do not ACK. The message remains unacked and will be redelivered by RabbitMQ.
          // This preserves atomicity.
        }
      } else {
        if (retryCount >= MAX_RETRIES) {
          this.logger.error(`Message exhausted ${MAX_RETRIES} retries. Routing to DLQ.`);
        } else {
          this.logger.error(`Permanent/poison error encountered. Routing directly to DLQ.`);
        }
        // NACK without requeue routes the message to the configured DLX/DLQ
        channel.nack(originalMsg, false, false);
      }
    }
  }

  private isTransientError(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';
    
    // Prisma connection or timeout errors
    if (code === 'P1001' || code === 'P1002' || code === 'P1008' || code === 'P2024') return true;
    if (msg.includes('timeout') || msg.includes('deadlock') || msg.includes('connection reset')) return true;
    
    // HTTP/Network related transient errors
    if (msg.includes('econnrefused') || msg.includes('enetunreach') || msg.includes('etimedout')) return true;
    
    return false;
  }
}
