import { RegisterStrategyHandler } from './register-strategy.handler';
import { RegisterStrategyCommand } from '../commands/register-strategy.command';
import { StrategyRepository } from '../../infrastructure/repositories/strategy.repository';

describe('RegisterStrategyHandler', () => {
  let handler: RegisterStrategyHandler;
  let repository: StrategyRepository;

  beforeEach(() => {
    repository = {
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as StrategyRepository;

    handler = new RegisterStrategyHandler(repository);
  });

  it('should save strategy', async () => {
    const command = new RegisterStrategyCommand(
      'org-1',
      'Test Strat',
      '1.0',
      null,
      'actor-1',
      'MODERATE',
    );

    const result = await handler.execute(command);
    
    expect(result).toBeDefined();
    expect(repository.save).toHaveBeenCalled();
  });
});
