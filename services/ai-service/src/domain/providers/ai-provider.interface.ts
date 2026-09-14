export interface InferenceRequest {
  modelId: string;
  provider: string; // 'OPENAI', 'ANTHROPIC'
  modelName: string; // 'gpt-4o', 'claude-3-5-sonnet'
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface InferenceResponse {
  confidence: number;
  marketRegime: string | null;
  suggestedSide: 'BUY' | 'SELL' | 'HOLD';
  suggestedSize?: number;
  suggestedEntry?: number;
  suggestedStopLoss?: number;
  suggestedTakeProfit?: number;
  reasoning: string;
  supportingSignals?: Record<string, unknown>;
  providerMetadata: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
  };
}

export const AI_PROVIDER_REGISTRY = Symbol('AI_PROVIDER_REGISTRY');

export interface IAIProvider {
  name: string;
  infer(request: InferenceRequest, credentials: Record<string, string>): Promise<InferenceResponse>;
}

export interface IAIProviderRegistry {
  getProvider(name: string): IAIProvider;
}
