import { Controller, Get, Post, Body, Param, Query, Headers, Req, HttpCode, HttpStatus, NotFoundException, BadRequestException, UseGuards } from '@nestjs/common';
import { WorkspaceScopeGuard, WorkspaceReadAccess, WorkspaceManageAccess } from '@veerox/shared';
import { PrismaService } from '@veerox/database';
import { SubscriptionService } from '../../application/services/subscription.service';
import { InvoiceService } from '../../application/services/invoice.service';
import { PaymentService } from '../../application/services/payment.service';
import { UsageService } from '../../application/services/usage.service';
import { BillingLedgerService } from '../../application/services/billing-ledger.service';
import { Decimal } from 'decimal.js';
import { randomUUID } from 'crypto';

export interface PayInvoiceDto {
  idempotencyKey?: string;
}

export interface CancelSubscriptionDto {
}

export interface RecordUsageDto {
  productId?: string;
  metricName: string;
  quantity: number;
  idempotencyKey?: string;
}

@Controller('api/v1/billing')
export class BillingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
    private readonly usageService: UsageService,
    private readonly ledgerService: BillingLedgerService,
  ) {}

  @Get('workspaces/:workspaceId/subscriptions')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getWorkspaceSubscriptions(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ success: boolean; data: any[] }> {
    const where: any = { workspaceId: req.workspaceId, organizationId: req.organizationId };

    const subscriptions = await this.prisma.productSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: subscriptions,
    };
  }

  @Get('workspaces/:workspaceId/subscriptions/:id')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getSubscription(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean; data: any }> {
    const subscription = await this.prisma.productSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    // Tenant isolation: verify ownership
    if (subscription.organizationId !== req.organizationId || subscription.workspaceId !== req.workspaceId) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }

    return {
      success: true,
      data: subscription,
    };
  }

  @Post('workspaces/:workspaceId/subscriptions/:id/cancel')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceManageAccess()
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: CancelSubscriptionDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.subscriptionService.cancelSubscription(id, req.organizationId, req.workspaceId);
      return {
        success: true,
        message: `Subscription ${id} canceled successfully`,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to cancel subscription');
    }
  }

  @Get('workspaces/:workspaceId/invoices')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getWorkspaceInvoices(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ success: boolean; data: any[] }> {
    const where: any = { workspaceId: req.workspaceId, organizationId: req.organizationId };

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: invoices,
    };
  }

  @Get('workspaces/:workspaceId/invoices/:id')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getInvoice(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean; data: any }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: true, paymentAttempts: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    // Tenant isolation: verify ownership
    if (invoice.organizationId !== req.organizationId || invoice.workspaceId !== req.workspaceId) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    return {
      success: true,
      data: invoice,
    };
  }

  @Post('workspaces/:workspaceId/invoices/:id/pay')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceManageAccess()
  @HttpCode(HttpStatus.OK)
  async payInvoice(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: PayInvoiceDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ): Promise<{ success: boolean; message: string }> {
    const idempotencyKey = body.idempotencyKey || headerIdempotencyKey || randomUUID();

    try {
      await this.paymentService.payInvoice(id, req.organizationId, req.workspaceId, idempotencyKey);
      return {
        success: true,
        message: `Invoice ${id} paid successfully`,
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Payment failed');
    }
  }

  @Post('workspaces/:workspaceId/usage')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceManageAccess()
  @HttpCode(HttpStatus.CREATED)
  async recordUsage(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
    @Body() body: RecordUsageDto,
    @Headers('idempotency-key') headerIdempotencyKey?: string,
  ): Promise<{ success: boolean; data: { usageId: string } }> {
    if (!body.metricName || body.quantity === undefined) {
      throw new BadRequestException('metricName and quantity are required');
    }

    const idempotencyKey = body.idempotencyKey || headerIdempotencyKey || randomUUID();

    try {
      const usageId = await this.usageService.recordUsage({
        organizationId: req.organizationId,
        workspaceId: req.workspaceId,
        productId: body.productId,
        metricName: body.metricName,
        quantity: new Decimal(body.quantity),
        idempotencyKey,
      });

      return {
        success: true,
        data: { usageId },
      };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Failed to record usage');
    }
  }

  @Get('workspaces/:workspaceId/usage')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getWorkspaceUsage(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
    @Query('metricName') metricName?: string,
  ): Promise<{ success: boolean; data: any[] }> {
    const where: any = { workspaceId: req.workspaceId };
    if (metricName) {
      where.metricName = metricName;
    }

    const records = await this.prisma.usageRecord.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return {
      success: true,
      data: records,
    };
  }

  @Get('workspaces/:workspaceId/ledger')
  @UseGuards(WorkspaceScopeGuard)
  @WorkspaceReadAccess()
  async getWorkspaceLedger(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
  ): Promise<{ success: boolean; data: { entries: any[]; summary: any } }> {
    const entries = await this.prisma.billingLedgerEntry.findMany({
      where: { workspaceId: req.workspaceId, organizationId: req.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let totalCharges = new Decimal(0);
    let totalPayments = new Decimal(0);
    let totalRefunds = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const entry of entries) {
      const amt = new Decimal(entry.amount.toString());
      if (entry.transactionType === 'CHARGE') totalCharges = totalCharges.plus(amt);
      else if (entry.transactionType === 'PAYMENT') totalPayments = totalPayments.plus(amt);
      else if (entry.transactionType === 'REFUND') totalRefunds = totalRefunds.plus(amt);
      else if (entry.transactionType === 'CREDIT') totalCredits = totalCredits.plus(amt);
    }

    const balance = totalCharges.minus(totalPayments).minus(totalCredits).plus(totalRefunds);

    return {
      success: true,
      data: {
        entries,
        summary: {
          totalCharges: totalCharges.toString(),
          totalPayments: totalPayments.toString(),
          totalRefunds: totalRefunds.toString(),
          totalCredits: totalCredits.toString(),
          balance: balance.toString(),
        },
      },
    };
  }
}
