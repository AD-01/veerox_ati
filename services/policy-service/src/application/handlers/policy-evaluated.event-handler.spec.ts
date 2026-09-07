import { PolicyEvaluatedEventHandler } from './policy-evaluated.event-handler';
import { PolicyEvaluatedEvent } from '@veerox/events';
import { ResolvePolicyDecisionCommand } from '../commands/resolve-policy-decision.command';
import { PrismaClient } from '@prisma/client';
import { CommandBus } from '@nestjs/cqrs';

describe('PolicyEvaluatedEventHandler', () => {
  let handler: PolicyEvaluatedEventHandler;
  let mockFindUnique: jest.Mock;
  let mockUpsert: jest.Mock;
  let mockExecute: jest.Mock;
  let prisma: PrismaClient;
  let commandBus: CommandBus;

  beforeEach(() => {
    mockFindUnique = jest.fn();
    mockUpsert = jest.fn();
    mockExecute = jest.fn();

    prisma = Object.assign(Object.create(PrismaClient.prototype), {
      decision: { findUnique: mockFindUnique },
      policyResolutionState: { upsert: mockUpsert },
    });
    
    commandBus = Object.assign(Object.create(CommandBus.prototype), {
      execute: mockExecute,
    });
    
    handler = new PolicyEvaluatedEventHandler(prisma, commandBus);
  });

  const event = new PolicyEvaluatedEvent(
    'eval-1', 'policy-1', 1, 'dec-1', 'corr-1', 'org-1', 'ws-1', 'ALLOW', 
    { limits: {}, prohibitions: [] }, [], [], {}, new Date()
  );

  it('should fail closed if tenant mismatch', async () => {
    mockFindUnique.mockResolvedValue({ id: 'dec-1', organizationId: 'wrong-org', workspaceId: 'ws-1' });
    await handler.handle(event);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('should upsert state and dispatch command', async () => {
    mockFindUnique.mockResolvedValue({ id: 'dec-1', organizationId: 'org-1', workspaceId: 'ws-1' });
    
    await handler.handle(event);
    
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { correlationId: 'corr-1' },
      create: expect.objectContaining({ correlationId: 'corr-1' }),
      update: {},
    });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const cmd = mockExecute.mock.calls[0][0] as ResolvePolicyDecisionCommand;
    expect(cmd.correlationId).toBe('corr-1');
  });
});
