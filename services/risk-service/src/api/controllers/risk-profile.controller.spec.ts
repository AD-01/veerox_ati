import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { RiskProfileController } from './risk-profile.controller';
import { PrismaService } from '@veerox/database';
import { NotFoundException } from '@nestjs/common';
import { ConfigureRiskProfileDto } from '../dto/configure-risk-profile.dto';

describe('RiskProfileController', () => {
  let controller: RiskProfileController;
  let commandBus: { execute: jest.Mock };
  let prismaService: { riskProfile: { findUnique: jest.Mock } };

  beforeEach(async () => {
    commandBus = {
      execute: jest.fn(),
    };

    prismaService = {
      riskProfile: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskProfileController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    controller = module.get<RiskProfileController>(RiskProfileController);
  });

  it('should throw NotFoundException if risk profile does not exist on get', async () => {
    prismaService.riskProfile.findUnique.mockResolvedValue(null);
    await expect(controller.getRiskProfile('ws-1')).rejects.toThrow(NotFoundException);
  });

  it('should return risk profile on get', async () => {
    const profile = { id: 'rp-1', workspaceId: 'ws-1' };
    prismaService.riskProfile.findUnique.mockResolvedValue(profile);
    const result = await controller.getRiskProfile('ws-1');
    expect(result).toBe(profile);
  });

  it('should dispatch ConfigureRiskProfileCommand on configureRiskProfile', async () => {
    const dto: ConfigureRiskProfileDto = {
      maxDailyLoss: 5,
      maxDrawdown: 10,
      maxPositionSize: 100,
      maxOpenPositions: 5,
      marginThreshold: 20,
    };
    const user = { id: 'actor-1' };

    await controller.configureRiskProfile('ws-1', dto, user);
    expect(commandBus.execute).toHaveBeenCalled();
  });
});
