import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { RequestAIInferenceHandler } from './application/handlers/request-ai-inference.handler';
import { AIModelPrismaRepository } from './infrastructure/repositories/ai-model.prisma-repository';
import { AIConfigurationPrismaRepository } from './infrastructure/repositories/ai-configuration.prisma-repository';
import { AIRecommendationPrismaRepository } from './infrastructure/repositories/ai-recommendation.prisma-repository';
import { AIProviderRegistry } from './infrastructure/providers/ai-provider.registry';
import { CredentialService } from './infrastructure/providers/credential.service';
import { PromptBuilder } from './infrastructure/providers/prompt-builder';
import { AI_MODEL_REPOSITORY } from './domain/repositories/ai-model.repository';
import { AI_CONFIGURATION_REPOSITORY } from './domain/repositories/ai-configuration.repository';
import { AI_RECOMMENDATION_REPOSITORY } from './domain/repositories/ai-recommendation.repository';
import { AI_PROVIDER_REGISTRY } from './domain/providers/ai-provider.interface';
import { CREDENTIAL_SERVICE } from './domain/providers/credential.service.interface';
import { PROMPT_BUILDER } from './domain/providers/prompt-builder.interface';

const CommandHandlers = [RequestAIInferenceHandler];
const QueryHandlers = [];
const Repositories = [
  { provide: AI_MODEL_REPOSITORY, useClass: AIModelPrismaRepository },
  { provide: AI_CONFIGURATION_REPOSITORY, useClass: AIConfigurationPrismaRepository },
  { provide: AI_RECOMMENDATION_REPOSITORY, useClass: AIRecommendationPrismaRepository },
  { provide: AI_PROVIDER_REGISTRY, useClass: AIProviderRegistry },
  { provide: CREDENTIAL_SERVICE, useClass: CredentialService },
  { provide: PROMPT_BUILDER, useClass: PromptBuilder },
];

@Module({
  imports: [
    CqrsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule,
  ],
  controllers: [],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...Repositories,
    PrismaService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
