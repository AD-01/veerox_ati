import { AgentState, StateMachine } from '../core/state-machine';

describe('StateMachine', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  it('should start in DISCONNECTED', () => {
    expect(sm.getState()).toBe(AgentState.DISCONNECTED);
  });

  it('should only allow financial processing in CONNECTED state', () => {
    expect(sm.canProcessFinancialCommands()).toBe(false);

    sm.transition(AgentState.AUTHENTICATING);
    expect(sm.canProcessFinancialCommands()).toBe(false);

    sm.transition(AgentState.CONNECTED);
    expect(sm.canProcessFinancialCommands()).toBe(true);

    sm.transition(AgentState.DEGRADED);
    expect(sm.canProcessFinancialCommands()).toBe(false);

    sm.transition(AgentState.RECOVERY_REQUIRED);
    expect(sm.canProcessFinancialCommands()).toBe(false);
  });
});
