export const PROMPT_BUILDER = Symbol('PROMPT_BUILDER');

export interface PromptContext {
  strategyId?: string;
  symbol: string;
  marketData: Record<string, unknown>; // Unstructured market data (e.g. OHLCV, indicators)
}

export interface IPromptBuilder {
  buildSystemPrompt(context: PromptContext): string;
  buildUserPrompt(context: PromptContext): string;
}
