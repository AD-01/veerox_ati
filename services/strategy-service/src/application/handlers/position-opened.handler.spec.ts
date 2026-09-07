import { PositionOpenedHandler } from './position-opened.handler';
import { OpenPositionRepository } from '../../infrastructure/repositories/open-position.repository';

// Assuming PositionOpenedEvent is imported from events package in real code
class MockPositionOpenedEvent {
  constructor(
    public readonly positionId: string,
    public readonly strategyId: string,
    public readonly workspaceId: string,
    public readonly symbol: string,
    public readonly type: 'LONG' | 'SHORT',
    public readonly volume: number,
    public readonly openPrice: number,
    public readonly timestamp: Date,
  ) {}
}

describe('PositionOpenedHandler', () => {
  let handler: PositionOpenedHandler;
  let repository: OpenPositionRepository;

  beforeEach(() => {
    repository = {
      upsertPosition: jest.fn().mockResolvedValue(undefined),
    } as unknown as OpenPositionRepository;

    handler = new PositionOpenedHandler(repository);
  });

  it('should save the open position to the read model', async () => {
    const event = new MockPositionOpenedEvent(
      'pos-1',
      'strat-1',
      'ws-1',
      'EURUSD',
      'LONG',
      1000,
      1.1000,
      new Date(),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler.handle(event as any);

    expect(repository.upsertPosition).toHaveBeenCalled();
  });
});
