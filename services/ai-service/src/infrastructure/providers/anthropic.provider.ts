import { Injectable, Logger } from '@nestjs/common';
import { IAIProvider, InferenceRequest, InferenceResponse } from '../../domain/providers/ai-provider.interface';
import { AppException } from '@veerox/shared';

@Injectable()
export class AnthropicProvider implements IAIProvider {
  public readonly name = 'ANTHROPIC';
  private readonly logger = new Logger(AnthropicProvider.name);

  async infer(request: InferenceRequest, credentials: Record<string, string>): Promise<InferenceResponse> {
    const apiKey = credentials['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new AppException('UNAUTHORIZED', 'Missing ANTHROPIC_API_KEY credential');
    }

    const payload = {
      model: request.modelName,
      max_tokens: 1024,
      system: request.systemPrompt,
      messages: [
        { role: 'user', content: request.userPrompt },
      ],
      temperature: request.temperature ?? 0.0,
    };

    const startTime = Date.now();
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (attempt < MAX_RETRIES && (response.status === 429 || response.status >= 500)) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
            continue;
          }
          throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as {
          content?: { text?: string }[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const latencyMs = Date.now() - startTime;
        
        const content = data.content?.[0]?.text;
        if (!content) {
          throw new Error('Malformed Anthropic response: missing content');
        }

        const parsed = JSON.parse(content) as Record<string, unknown>;

        return {
          confidence: Number(parsed.confidence),
          marketRegime: parsed.marketRegime ? String(parsed.marketRegime) : null,
          suggestedSide: parsed.suggestedSide as 'BUY' | 'SELL' | 'HOLD',
          suggestedSize: parsed.suggestedSize ? Number(parsed.suggestedSize) : undefined,
          suggestedEntry: parsed.suggestedEntry ? Number(parsed.suggestedEntry) : undefined,
          suggestedStopLoss: parsed.suggestedStopLoss ? Number(parsed.suggestedStopLoss) : undefined,
          suggestedTakeProfit: parsed.suggestedTakeProfit ? Number(parsed.suggestedTakeProfit) : undefined,
          reasoning: parsed.reasoning ? String(parsed.reasoning) : 'No reasoning provided',
          supportingSignals: (parsed.supportingSignals as Record<string, unknown>) || {},
          providerMetadata: {
            promptTokens: data.usage?.input_tokens || 0,
            completionTokens: data.usage?.output_tokens || 0,
            totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
            latencyMs,
          }
        };
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        const err = error as Error;

        if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.message.includes('fetch'))) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }

        this.logger.error(`Anthropic inference failed: ${err.message}`);
        throw new AppException('INTERNAL_SERVER_ERROR', `AI Inference failed: ${err.message}`);
      }
    }
    
    throw new AppException('INTERNAL_SERVER_ERROR', 'AI Inference failed after maximum retries');
  }
}
