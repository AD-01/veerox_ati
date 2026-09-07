import { Test, TestingModule } from '@nestjs/testing';
import { ExpertAdvisorController } from './expert-advisor.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ObjectStorageService } from '../../infrastructure/storage/object-storage.service';

describe('ExpertAdvisorController', () => {
  let controller: ExpertAdvisorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpertAdvisorController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: QueryBus, useValue: { execute: jest.fn() } },
        { provide: ObjectStorageService, useValue: { uploadBinary: jest.fn() } },
      ],
    }).compile();

    controller = module.get<ExpertAdvisorController>(ExpertAdvisorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
