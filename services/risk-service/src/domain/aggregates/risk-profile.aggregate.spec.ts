import { RiskProfile } from './risk-profile.aggregate';
import { RiskProfileConfiguredEvent } from '@veerox/events';

describe('RiskProfile Aggregate', () => {
  it('should create a new risk profile and apply limits correctly', () => {
    const profile = new RiskProfile(
      'id-123',
      'org-123',
      'workspace-123',
      0,
      0,
      0,
      0,
      0,
      'ACTIVE',
    );

    profile.configureLimits(5.0, 10.0, 1000, 5, 20.0, 'actor-1');

    expect(profile.getMaxDailyLoss()).toBe(5.0);
    expect(profile.getMaxDrawdown()).toBe(10.0);
    expect(profile.getMaxPositionSize()).toBe(1000);
    expect(profile.getMaxOpenPositions()).toBe(5);
    expect(profile.getMarginThreshold()).toBe(20.0);

    const uncommittedEvents = profile.getUncommittedEvents();
    expect(uncommittedEvents).toHaveLength(1);
    expect(uncommittedEvents[0]).toBeInstanceOf(RiskProfileConfiguredEvent);
    
    const event = uncommittedEvents[0] as RiskProfileConfiguredEvent;
    expect(event.workspaceId).toBe('workspace-123');
    expect(event.maxDailyLoss).toBe(5.0);
    expect(event.actorId).toBe('actor-1');
  });

  it('should retain uncommitted events until committed', () => {
    const profile = new RiskProfile(
      'id-1', 'org-1', 'workspace-1', 0, 0, 0, 0, 0, 'ACTIVE'
    );
    profile.configureLimits(1, 2, 3, 4, 5, 'actor-1');
    expect(profile.getUncommittedEvents()).toHaveLength(1);
    profile.commit();
    expect(profile.getUncommittedEvents()).toHaveLength(0);
  });
});
