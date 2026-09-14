import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaService } from '@veerox/database';
import { LicenseService } from './application/services/license.service';
import { LicenseValidationService } from './application/services/license-validation.service';
import { PrismaLicenseRepository } from './infrastructure/repositories/prisma-license.repository';
import { Ed25519CryptoService } from './infrastructure/crypto/ed25519-crypto.service';
import { BillingEventConsumer } from './infrastructure/billing-integration/billing-event.consumer';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';
import { PrismaOutboxRepository } from './infrastructure/repositories/prisma-outbox.repository';
import { LicensingController } from './interfaces/rest/licensing.controller';
import { ObservabilityModule, RequestContextMiddleware } from '@veerox/shared';

@Module({
  controllers: [LicensingController],
  providers: [
    PrismaService,
    LicenseService,
    LicenseValidationService,
    BillingEventConsumer,
    { provide: 'ILicenseRepository', useClass: PrismaLicenseRepository },
    { provide: 'ICryptoService', useClass: Ed25519CryptoService },
    { provide: 'IAuditRepository', useClass: PrismaAuditRepository },
    { provide: 'IOutboxRepository', useClass: PrismaOutboxRepository }
  ],
  exports: [
    LicenseService,
    LicenseValidationService
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
