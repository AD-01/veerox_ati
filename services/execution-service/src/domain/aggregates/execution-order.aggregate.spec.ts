import { ExecutionOrder, ExecutionOrderStatus } from './execution-order.aggregate';
import {
  ExecutionOrderCreatedEvent,
  ExecutionOrderCompletedEvent,
  ExecutionOrderFailedEvent,
} from '@veerox/events';

describe('ExecutionOrder Aggregate', () => {
  const defaultProps = {
    id: 'ord-123',
    workspaceId: 'ws-123',
    organizationId: 'org-123',
    accountId: 'acc-123',
    symbolId: 'sym-123',
    decisionId: 'dec-123',
    correlationId: 'cor-123',
    orderType: 'MARKET',
    side: 'BUY',
    size: 1.5,
    requestedPrice: null,
    stopLoss: null,
    takeProfit: null,
  };

  let order: ExecutionOrder;

  beforeEach(() => {
    order = new ExecutionOrder(
      defaultProps.id,
      defaultProps.workspaceId,
      defaultProps.organizationId,
      defaultProps.accountId,
      defaultProps.symbolId,
      defaultProps.decisionId,
      defaultProps.correlationId,
      defaultProps.orderType,
      defaultProps.side,
      defaultProps.size,
      defaultProps.requestedPrice,
      defaultProps.stopLoss,
      defaultProps.takeProfit,
    );
  });

  it('should create in PENDING state and emit ExecutionOrderCreatedEvent', () => {
    order.create();
    const uncommittedEvents = order.getUncommittedEvents();

    expect(order.getStatus()).toBe(ExecutionOrderStatus.PENDING);
    expect(uncommittedEvents.length).toBe(1);
    expect(uncommittedEvents[0]).toBeInstanceOf(ExecutionOrderCreatedEvent);
  });

  it('should transition to DISPATCHED when dispatching', () => {
    order.dispatch('cmd-123');
    expect(order.getStatus()).toBe(ExecutionOrderStatus.DISPATCHED);
    expect(order.getConnectorCommandId()).toBe('cmd-123');
  });

  it('should throw if dispatching a non-PENDING order', () => {
    order.dispatch('cmd-123');
    expect(() => order.dispatch('cmd-456')).toThrowError('Can only dispatch PENDING orders');
  });

  it('should fill order from DISPATCHED state', () => {
    order.dispatch('cmd-123');
    order.fill(1.2345);

    const uncommittedEvents = order.getUncommittedEvents();
    expect(order.getStatus()).toBe(ExecutionOrderStatus.FILLED);
    expect(order.getExecutedPrice()).toBe(1.2345);
    expect(uncommittedEvents[0]).toBeInstanceOf(ExecutionOrderCompletedEvent);
  });

  it('should reject order and emit ExecutionOrderFailedEvent', () => {
    order.dispatch('cmd-123');
    order.reject('Broker rejected');

    const uncommittedEvents = order.getUncommittedEvents();
    expect(order.getStatus()).toBe(ExecutionOrderStatus.REJECTED);
    expect(order.getFailureReason()).toBe('Broker rejected');
    expect(uncommittedEvents[0]).toBeInstanceOf(ExecutionOrderFailedEvent);
  });

  it('should fail order if unexpected error occurs', () => {
    order.fail('Internal system error');
    
    const uncommittedEvents = order.getUncommittedEvents();
    expect(order.getStatus()).toBe(ExecutionOrderStatus.FAILED);
    expect(order.getFailureReason()).toBe('Internal system error');
    expect(uncommittedEvents[0]).toBeInstanceOf(ExecutionOrderFailedEvent);
  });
});
