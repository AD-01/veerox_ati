import { AtiClient } from './client/ati-client';

export class Agent {
  private client: AtiClient;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private commandPollInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private connectorId: string, 
    clientSecret: string, 
    private orgId: string, 
    private workspaceId: string,
    baseUrl?: string
  ) {
    this.client = new AtiClient(connectorId, clientSecret, baseUrl);
  }

  async start() {
    console.log(`[Agent] Starting mock agent for connector ${this.connectorId}...`);
    
    try {
      await this.client.authenticate();
    } catch (err) {
      console.error(`[Agent] Failed to authenticate:`, err);
      process.exit(1);
    }

    // Start Heartbeat Loop
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.client.sendHeartbeat(this.orgId, this.workspaceId, {
          agentVersion: '1.0.0-mock',
          health: {
            cpuUsage: Math.random() * 20, // Simulated 0-20% cpu usage
            memoryUsage: Math.random() * 50 + 100, // Simulated 100-150MB memory
            networkLatency: Math.floor(Math.random() * 50) + 10, // Simulated 10-60ms
          }
        });
        console.log(`[Agent] Heartbeat sent successfully.`);
      } catch (err) {
        console.error(`[Agent] Heartbeat failed:`, (err as any).message);
      }
    }, 10000); // 10s

    // Start Command Polling Loop
    this.commandPollInterval = setInterval(async () => {
      try {
        const command = await this.client.fetchPendingCommand(this.orgId, this.workspaceId);
        if (command) {
          console.log(`[Agent] Claimed pending command:`, command.id, command.commandType);
          
          // Simulate execution delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await this.client.submitCommandResponse(this.orgId, this.workspaceId, command.id, 'OK', JSON.stringify({ result: 'Simulated Execution Success' }));
          console.log(`[Agent] Submitted OK response for command:`, command.id);
        }
      } catch (err) {
        console.error(`[Agent] Command polling failed:`, (err as any).message);
      }
    }, 5000); // 5s
  }

  stop() {
    console.log(`[Agent] Stopping mock agent...`);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.commandPollInterval) clearInterval(this.commandPollInterval);
  }
}
