import { Injectable, Logger } from '@nestjs/common';
import { IAIProvider, InferenceRequest, InferenceResponse } from '../../domain/providers/ai-provider.interface';
import { AppException } from '@veerox/shared';

@Injectable()
export class OpenAIProvider implements IAIProvider {
  public readonly name = 'OPENAI';
  private readonly logger = new Logger(OpenAIProvider.name);

  async infer(request: InferenceRequest, credentials: Record<string, string>): Promise<InferenceResponse> {
    const apiKey = credentials['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new AppException('UNAUTHORIZED', 'Missing OPENAI_API_KEY credential');
    }

    const payload = {
      model: request.modelName,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      temperature: request.temperature ?? 0.0,
      response_format: { type: 'json_object' }
    };

    const startTime = Date.now();
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (attempt < MAX_RETRIES && (response.status === 429 || response.status >= 500)) {
            // Transient error: retry with exponential backoff
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
            continue;
          }
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const latencyMs = Date.now() - startTime;
        
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Malformed OpenAI response: missing content');
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
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
            latencyMs,
          }
        };
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        const err = error as Error;
        
        if (attempt < MAX_RETRIES && (err.name === 'AbortError' || err.message.includes('fetch') || err.message.includes('AbortError'))) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }

        this.logger.error(`OpenAI inference failed: ${err.message}`);
        throw new AppException('INTERNAL_SERVER_ERROR', `AI Inference failed: ${err.message}`);
      }
    }
    
    throw new AppException('INTERNAL_SERVER_ERROR', 'AI Inference failed after maximum retries');
  }
}
