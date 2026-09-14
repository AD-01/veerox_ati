import { Injectable, Inject, Optional } from '@nestjs/common';
import { IAIProvider, IAIProviderRegistry } from '../../domain/providers/ai-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { AppException } from '@veerox/shared';

@Injectable()
export class AIProviderRegistry implements IAIProviderRegistry {
  private readonly providers = new Map<string, IAIProvider>();

  constructor(
    @Optional() @Inject(OpenAIProvider) private readonly openai: OpenAIProvider,
    @Optional() @Inject(AnthropicProvider) private readonly anthropic: AnthropicProvider,
  ) {
    if (this.openai) this.providers.set(this.openai.name, this.openai);
    if (this.anthropic) this.providers.set(this.anthropic.name, this.anthropic);
  }

  getProvider(name: string): IAIProvider {
    const provider = this.providers.get(name.toUpperCase());
    if (!provider) {
      throw new AppException('BAD_REQUEST', `Unsupported AI Provider: ${name}`);
    }
    return provider;
  }
}
