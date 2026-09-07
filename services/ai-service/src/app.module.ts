import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { GenerateAIRecommendationHandler } from './application/handlers/generate-ai-recommendation.handler';

const CommandHandlers = [GenerateAIRecommendationHandler];
const QueryHandlers = [];
const Repositories = [];

@Module({
  imports: [
    CqrsModule,
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  controllers: [],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...Repositories,
    PrismaService,
  ],
})
export class AppModule {}
