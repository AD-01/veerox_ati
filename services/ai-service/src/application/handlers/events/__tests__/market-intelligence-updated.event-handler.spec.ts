import { MarketIntelligenceUpdatedEventHandler } from '../market-intelligence-updated.event-handler';
import { MarketIntelligenceUpdatedEvent } from '@veerox/events';
import { PrismaService } from '@veerox/database';
import { CommandBus } from '@nestjs/cqrs';
import { RequestAIInferenceCommand } from '../../../commands/request-ai-inference.command';

describe('MarketIntelligenceUpdatedEventHandler', () => {
  let handler: MarketIntelligenceUpdatedEventHandler;
  let prisma: Partial<PrismaService>;
  let commandBus: Partial<CommandBus>;

  beforeEach(() => {
    prisma = {
      aIConfiguration: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      } as unknown as typeof prisma.aIConfiguration,
      openPositionReadModel: {
        findMany: jest.fn().mockResolvedValue([]),
      } as unknown as typeof prisma.openPositionReadModel,
      aIModel: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1', modelVersion: 'v1' }),
      } as unknown as typeof prisma.aIModel,
    };
    commandBus = { execute: jest.fn() };
    handler = new MarketIntelligenceUpdatedEventHandler(prisma as PrismaService, commandBus as CommandBus);
  });

  const event = new MarketIntelligenceUpdatedEvent('sym', new Date('2023-10-01T12:05:01Z'), 'M15', { direction: 'UP', strength: 0.8 }, 0.1, 0.9, 'BULL', 0.8, 0.9, 1);

  const activeConfig = {
    id: 'cfg-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    inferenceIntervalMinutes: 5,
    lastInferenceAt: null,
    workspace: { tradingAccounts: [{ id: 'acc-1' }] }
  };

  it('should successfully dispatch on acquired lock', async () => {
    (prisma.aIConfiguration!.findMany as jest.Mock).mockResolvedValue([activeConfig]);
    (prisma.aIConfiguration!.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await handler.handle(event);

    expect(prisma.aIConfiguration!.updateMany).toHaveBeenCalled();
    expect(commandBus.execute).toHaveBeenCalled();
    const command = (commandBus.execute as jest.Mock).mock.calls[0][0];
    expect(command).toBeInstanceOf(RequestAIInferenceCommand);
  });

  it('should skip inference if lock not acquired (count 0)', async () => {
    (prisma.aIConfiguration!.findMany as jest.Mock).mockResolvedValue([activeConfig]);
    (prisma.aIConfiguration!.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await handler.handle(event);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });
  
  it('should produce identical idempotency key for same time bucket', async () => {
    (prisma.aIConfiguration!.findMany as jest.Mock).mockResolvedValue([activeConfig]);
    (prisma.aIConfiguration!.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const event1 = new MarketIntelligenceUpdatedEvent('sym', new Date('2023-10-01T12:05:01Z'), 'M15', { direction: 'UP', strength: 0.8 }, 0.1, 0.9, 'BULL', 0.8, 0.9, 1);
    const event2 = new MarketIntelligenceUpdatedEvent('sym', new Date('2023-10-01T12:08:59Z'), 'M15', { direction: 'UP', strength: 0.8 }, 0.1, 0.9, 'BULL', 0.8, 0.9, 1);

    await handler.handle(event1);
    const key1 = (commandBus.execute as jest.Mock).mock.calls[0][0].idempotencyKey;
    
    (commandBus.execute as jest.Mock).mockClear();
    
    await handler.handle(event2);
    const key2 = (commandBus.execute as jest.Mock).mock.calls[0][0].idempotencyKey;

    expect(key1).toEqual(key2);
  });

  it('should produce different idempotency key for different time bucket', async () => {
    (prisma.aIConfiguration!.findMany as jest.Mock).mockResolvedValue([activeConfig]);
    (prisma.aIConfiguration!.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const event1 = new MarketIntelligenceUpdatedEvent('sym', new Date('2023-10-01T12:05:01Z'), 'M15', { direction: 'UP', strength: 0.8 }, 0.1, 0.9, 'BULL', 0.8, 0.9, 1);
    const event2 = new MarketIntelligenceUpdatedEvent('sym', new Date('2023-10-01T12:10:01Z'), 'M15', { direction: 'UP', strength: 0.8 }, 0.1, 0.9, 'BULL', 0.8, 0.9, 1);

    await handler.handle(event1);
    const key1 = (commandBus.execute as jest.Mock).mock.calls[0][0].idempotencyKey;
    
    (commandBus.execute as jest.Mock).mockClear();
    
    await handler.handle(event2);
    const key2 = (commandBus.execute as jest.Mock).mock.calls[0][0].idempotencyKey;

    expect(key1).not.toEqual(key2);
  });
});
