import { Test, TestingModule } from '@nestjs/testing';
import { StrategyController } from './strategy.controller';
import { CommandBus } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import { RegisterStrategyCommand } from '../../application/commands/register-strategy.command';

describe('StrategyController', () => {
  let controller: StrategyController;
  let commandBus: CommandBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StrategyController],
      providers: [
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn().mockResolvedValue('strategy-123'),
          },
        },
      ],
    }).compile();

    controller = module.get<StrategyController>(StrategyController);
    commandBus = module.get<CommandBus>(CommandBus);
  });

  it('should register a strategy', async () => {
    const dto = {
      name: 'Test Strategy',
      version: '1.0.0',
      description: 'A test strategy',
      riskProfile: 'MODERATE' as const,
    };
    
    const req = {
      user: {
        userId: 'actor-123',
        roles: [{ organizationId: 'org-1' }],
      },
    };

    const result = await controller.registerStrategy('org-1', dto, req);

    expect(result).toEqual({ id: 'strategy-123', message: 'Strategy registered successfully in DRAFT state' });
    expect(commandBus.execute).toHaveBeenCalledWith(
      new RegisterStrategyCommand('org-1', 'Test Strategy', '1.0.0', 'A test strategy', 'actor-123', 'MODERATE'),
    );
  });

  it('should throw UnauthorizedException if userId is missing', async () => {
    const dto = {
      name: 'Test Strategy',
      version: '1.0.0',
      riskProfile: 'MODERATE' as const,
    };
    
    const req = {
      user: {
        roles: [{ organizationId: 'org-1' }],
      },
    };

    await expect(controller.registerStrategy('org-1', dto, req)).rejects.toThrow(UnauthorizedException);
  });
});
