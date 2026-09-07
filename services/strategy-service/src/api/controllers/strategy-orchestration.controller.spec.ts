import { Test, TestingModule } from '@nestjs/testing';
import { StrategyOrchestrationController } from './strategy-orchestration.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

describe('StrategyOrchestrationController', () => {
  let controller: StrategyOrchestrationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StrategyOrchestrationController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: QueryBus, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    controller = module.get<StrategyOrchestrationController>(StrategyOrchestrationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
