import { TradingAccount } from './trading-account.aggregate';
import { TradingAccountCreatedEvent, TradingAccountUpdatedEvent, TradingAccountArchivedEvent } from '@veerox/events';

describe('TradingAccount Aggregate', () => {
  const accountId = 'account-1';
  const organizationId = 'org-1';
  const workspaceId = 'workspace-1';
  const connectorId = 'connector-1';

  describe('create', () => {
    it('should create an account and emit TradingAccountCreatedEvent', () => {
      const account = TradingAccount.create(
        accountId, organizationId, workspaceId, connectorId,
        'Broker', 'Server', '12345', 'My Account', 'REAL', '1:100', 'USD', 'MT5', '1.0'
      );

      expect(account.id).toBe(accountId);
      expect(account.status).toBe('PENDING');
      
      const events = account.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TradingAccountCreatedEvent);
    });
  });

  describe('update', () => {
    it('should update fields and emit TradingAccountUpdatedEvent', () => {
      const account = TradingAccount.create(
        accountId, organizationId, workspaceId, connectorId,
        'Broker', 'Server', '12345', 'My Account', 'REAL', '1:100', 'USD', 'MT5', '1.0'
      );
      account.commit();

      account.update({ accountName: 'New Name' });

      const events = account.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TradingAccountUpdatedEvent);
    });
  });

  describe('archive', () => {
    it('should set status to ARCHIVED and emit TradingAccountArchivedEvent', () => {
      const account = TradingAccount.create(
        accountId, organizationId, workspaceId, connectorId,
        'Broker', 'Server', '12345', 'My Account', 'REAL', '1:100', 'USD', 'MT5', '1.0'
      );
      account.commit();

      account.archive();

      expect(account.status).toBe('ARCHIVED');
      const events = account.getUncommittedEvents();
      expect(events[0]).toBeInstanceOf(TradingAccountArchivedEvent);
    });
  });
});
