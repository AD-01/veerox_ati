import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { MarketDataUpdatedHandler } from './market-data-updated.handler';
import { MarketDataUpdatedEvent } from '@veerox/events';
import { CalculateMarketSnapshotCommand } from '../commands/calculate-market-snapshot.command';

describe('MarketDataUpdatedHandler', () => {
  let handler: MarketDataUpdatedHandler;
  let commandBus: jest.Mocked<CommandBus>;

  beforeEach(async () => {
    const commandBusMock = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketDataUpdatedHandler,
        { provide: CommandBus, useValue: commandBusMock },
      ],
    }).compile();

    handler = module.get<MarketDataUpdatedHandler>(MarketDataUpdatedHandler);
    commandBus = module.get(CommandBus);
  });

  it('should ignore events where isClosed is false', async () => {
    const event = new MarketDataUpdatedEvent(
      '00000000-0000-0000-0000-000000000000',
      new Date(),
      'M1',
      1.1000,
      1.1050,
      1.0990,
      1.1040,
      1500,
      false // NOT closed
    );

    await handler.handle(event);

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('should dispatch CalculateMarketSnapshotCommand when isClosed is true', async () => {
    const event = new MarketDataUpdatedEvent(
      '00000000-0000-0000-0000-000000000000',
      new Date(),
      'M1',
      1.1000,
      1.1050,
      1.0990,
      1.1040,
      1500,
      true // IS closed
    );

    await handler.handle(event);

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.any(CalculateMarketSnapshotCommand)
    );

    const command = commandBus.execute.mock.calls[0][0] as CalculateMarketSnapshotCommand;
    expect(command.symbolId).toBe(event.symbolId);
    expect(command.timeframe).toBe(event.timeframe);
    expect(command.close).toBe(event.close);
  });
});
