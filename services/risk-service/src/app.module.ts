import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database/src/prisma.service';
import { ConfigModule } from '@nestjs/config';

import { RiskProfileCommandHandlers } from './application/handlers/risk-profile/risk-profile.command-handlers';
import { RiskProfileController } from './api/controllers/risk-profile.controller';
import { RISK_PROFILE_REPOSITORY } from './application/ports/risk-profile.repository.interface';
import { PrismaRiskProfileRepository } from './infrastructure/repositories/prisma-risk-profile.repository';
import { AUDIT_REPOSITORY } from './application/ports/audit.repository.interface';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';
import { TokenService } from './infrastructure/auth/token.service';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';

import { RiskAssessmentController } from './api/controllers/risk-assessment.controller';
import { EvaluateRiskCommandHandler, PORTFOLIO_READ_MODEL_REPOSITORY, MARKET_READ_MODEL_REPOSITORY, RISK_ASSESSMENT_REPOSITORY } from './application/handlers/risk-assessment/evaluate-risk.command-handler';
import { GetRiskAssessmentsQueryHandler } from './application/handlers/risk-assessment/get-risk-assessments.query-handler';
import { RiskCalculationService } from './domain/services/risk-calculation.service';
import { PrismaPortfolioReadModelRepository } from './infrastructure/repositories/prisma-portfolio-read-model.repository';
import { PrismaMarketReadModelRepository } from './infrastructure/repositories/prisma-market-read-model.repository';
import { PrismaRiskAssessmentRepository } from './infrastructure/repositories/prisma-risk-assessment.repository';
import { RecalculateRiskEventHandler } from './application/handlers/risk-assessment/recalculate-risk.event-handler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CqrsModule,
  ],
  controllers: [
    RiskProfileController,
    RiskAssessmentController,
  ],
  providers: [
    ...RiskProfileCommandHandlers,
    EvaluateRiskCommandHandler,
    GetRiskAssessmentsQueryHandler,
    RecalculateRiskEventHandler,
    RiskCalculationService,
    {
      provide: RISK_PROFILE_REPOSITORY,
      useClass: PrismaRiskProfileRepository,
    },
    {
      provide: AUDIT_REPOSITORY,
      useClass: PrismaAuditRepository,
    },
    {
      provide: PORTFOLIO_READ_MODEL_REPOSITORY,
      useClass: PrismaPortfolioReadModelRepository,
    },
    {
      provide: MARKET_READ_MODEL_REPOSITORY,
      useClass: PrismaMarketReadModelRepository,
    },
    {
      provide: RISK_ASSESSMENT_REPOSITORY,
      useClass: PrismaRiskAssessmentRepository,
    },
    TokenService,
    JwtStrategy,
    PrismaService,
  ],
})
export class AppModule {}
