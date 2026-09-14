import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';

import { SubscriptionService } from './application/services/subscription.service';
import { InvoiceService } from './application/services/invoice.service';
import { PaymentService } from './application/services/payment.service';
import { UsageService } from './application/services/usage.service';
import { BillingLedgerService } from './application/services/billing-ledger.service';
import { BillingPurchaseService } from './application/services/billing-purchase.service';

import { PrismaSubscriptionRepository } from './infrastructure/repositories/prisma-subscription.repository';
import { PrismaInvoiceRepository } from './infrastructure/repositories/prisma-invoice.repository';
import { PrismaPaymentAttemptRepository } from './infrastructure/repositories/prisma-payment-attempt.repository';
import { PrismaUsageRepository } from './infrastructure/repositories/prisma-usage.repository';
import { PrismaBillingLedgerRepository } from './infrastructure/repositories/prisma-billing-ledger.repository';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';
import { PrismaOutboxRepository } from './infrastructure/repositories/prisma-outbox.repository';
import { MockPaymentProvider } from './infrastructure/payment/mock-payment-provider';

import { BillingController } from './api/controllers/billing.controller';

const Services = [
  SubscriptionService,
  InvoiceService,
  PaymentService,
  UsageService,
  BillingLedgerService,
  BillingPurchaseService,
];

const Repositories = [
  PrismaSubscriptionRepository,
  PrismaInvoiceRepository,
  PrismaPaymentAttemptRepository,
  PrismaUsageRepository,
  PrismaBillingLedgerRepository,
  PrismaAuditRepository,
  PrismaOutboxRepository,
];

@Module({
  imports: [CqrsModule],
  controllers: [BillingController],
  providers: [
    PrismaService,
    ...Services,
    ...Repositories,
    { provide: 'ISubscriptionRepository', useExisting: PrismaSubscriptionRepository },
    { provide: 'IInvoiceRepository', useExisting: PrismaInvoiceRepository },
    { provide: 'IPaymentAttemptRepository', useExisting: PrismaPaymentAttemptRepository },
    { provide: 'IUsageRecordRepository', useExisting: PrismaUsageRepository },
    { provide: 'IBillingLedgerRepository', useExisting: PrismaBillingLedgerRepository },
    { provide: 'IAuditRepository', useExisting: PrismaAuditRepository },
    { provide: 'IOutboxRepository', useExisting: PrismaOutboxRepository },
    { provide: 'PaymentProvider', useClass: MockPaymentProvider },
  ],
  exports: [
    ...Services,
    ...Repositories,
  ],
})
export class BillingModule {}
