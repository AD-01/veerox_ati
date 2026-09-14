export enum AgentState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  AUTHENTICATING = 'AUTHENTICATING',
  NEGOTIATING = 'NEGOTIATING',
  CONNECTED = 'CONNECTED',
  DEGRADED = 'DEGRADED',
  RECONNECTING = 'RECONNECTING',
  RECOVERY_REQUIRED = 'RECOVERY_REQUIRED'
}

export class StateMachine {
  private currentState: AgentState = AgentState.DISCONNECTED;

  getState(): AgentState {
    return this.currentState;
  }

  transition(newState: AgentState): void {
    if (this.currentState === newState) return;
    
    // Strict transitions can be enforced here if needed
    // For now, allow valid transitions required by the protocol
    this.currentState = newState;
  }

  canProcessFinancialCommands(): boolean {
    return this.currentState === AgentState.CONNECTED;
  }
}
