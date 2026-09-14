import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@veerox/database';

import { PrismaMarketplaceRepository } from './infrastructure/repositories/prisma-marketplace.repository';
import { PrismaReviewRepository } from './infrastructure/repositories/prisma-review.repository';
import { BillingGrpcClient } from './infrastructure/grpc/billing-grpc.client';
import { LicensingGrpcClient } from './infrastructure/grpc/licensing-grpc.client';
import { MarketplaceEventConsumer } from './infrastructure/messaging/marketplace-event.consumer';
import { BillingPurchaseService } from '../../billing-service/src/application/services/billing-purchase.service';
import { PrismaSubscriptionRepository } from '../../billing-service/src/infrastructure/repositories/prisma-subscription.repository';
import { PrismaInvoiceRepository } from '../../billing-service/src/infrastructure/repositories/prisma-invoice.repository';
import { PrismaAuditRepository as BillingPrismaAuditRepository } from '../../billing-service/src/infrastructure/repositories/prisma-audit.repository';
import { PrismaOutboxRepository as BillingPrismaOutboxRepository } from '../../billing-service/src/infrastructure/repositories/prisma-outbox.repository';

import { PublishProductHandler } from './application/commands/publish-product.command';
import { InitiatePurchaseHandler } from './application/commands/initiate-purchase.command';
import { SubmitReviewHandler } from './application/commands/submit-review.command';
import { SearchProductsHandler } from './application/queries/search-products.query';
import { GetProductHandler } from './application/queries/get-product.query';
import { GetWorkspacePurchasesHandler } from './application/queries/get-workspace-purchases.query';
import { GetWorkspaceLicenseHandler } from './application/queries/get-workspace-license.query';

const Repositories = [
  PrismaMarketplaceRepository,
  PrismaReviewRepository,
  PrismaSubscriptionRepository,
  PrismaInvoiceRepository,
  BillingPrismaAuditRepository,
  BillingPrismaOutboxRepository
];

const GrpcClients = [
  BillingGrpcClient,
  LicensingGrpcClient
];

const CommandHandlers = [
  PublishProductHandler,
  InitiatePurchaseHandler,
  SubmitReviewHandler,
  BillingPurchaseService
];

const QueryHandlers = [
  SearchProductsHandler,
  GetProductHandler,
  GetWorkspacePurchasesHandler,
  GetWorkspaceLicenseHandler,
  
];

const EventConsumers = [
  MarketplaceEventConsumer
];

import { MarketplaceController } from './interfaces/rest/marketplace.controller';

@Module({
  imports: [
    CqrsModule
  ],
  controllers: [
    MarketplaceController
  ],
  providers: [
    PrismaService,
    { provide: 'ISubscriptionRepository', useExisting: PrismaSubscriptionRepository },
    { provide: 'IInvoiceRepository', useExisting: PrismaInvoiceRepository },
    { provide: 'IAuditRepository', useClass: BillingPrismaAuditRepository },
    { provide: 'IOutboxRepository', useClass: BillingPrismaOutboxRepository },
    ...Repositories,
    ...GrpcClients,
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventConsumers
  ],
  exports: [
    ...Repositories,
    ...GrpcClients
  ]
})
export class MarketplaceModule {}

