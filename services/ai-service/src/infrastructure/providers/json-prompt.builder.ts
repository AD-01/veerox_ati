import { Injectable } from '@nestjs/common';
import { IPromptBuilder, PromptContext } from '../../domain/providers/prompt-builder.interface';

@Injectable()
export class JsonPromptBuilder implements IPromptBuilder {
  buildSystemPrompt(context: PromptContext): string {
    return `You are a strict, quantitative financial trading AI for the Veerox platform.
Your task is to analyze the provided market context and output a trading recommendation strictly as a JSON object.
Do NOT include any markdown formatting, backticks, or conversational text. Output ONLY valid JSON.

The JSON schema MUST exactly match this structure:
{
  "confidence": <number between 0 and 1>,
  "marketRegime": <string or null, e.g. "TRENDING_UP", "RANGING">,
  "suggestedSide": <"BUY", "SELL", or "HOLD">,
  "suggestedSize": <positive number, or omit if HOLD>,
  "suggestedEntry": <positive number, or omit if HOLD>,
  "suggestedStopLoss": <positive number, must be < Entry for BUY, > Entry for SELL. Omit if HOLD>,
  "suggestedTakeProfit": <positive number, must be > Entry for BUY, < Entry for SELL. Omit if HOLD>,
  "reasoning": <string explaining the decision>,
  "supportingSignals": <object with key-value string pairs, optional>
}

Rules:
1. "suggestedSide" MUST be "BUY", "SELL", or "HOLD".
2. If "suggestedSide" is "BUY" or "SELL", "suggestedSize" MUST be greater than 0.
3. If "suggestedSide" is "BUY", ensure StopLoss < Entry < TakeProfit.
4. If "suggestedSide" is "SELL", ensure TakeProfit < Entry < StopLoss.
5. All financial values must be numbers (no strings).

Strategy Context: ${context.strategyId || 'Standard Technical Analysis'}
Symbol: ${context.symbol}`;
  }

  buildUserPrompt(context: PromptContext): string {
    return `Analyze the following market data and provide your recommendation according to the system rules:

Market Data:
${JSON.stringify(context.marketData, null, 2)}`;
  }
}
