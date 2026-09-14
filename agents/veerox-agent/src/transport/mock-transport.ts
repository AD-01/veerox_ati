import { ExecutionTransport } from './execution-transport';

export class MockTransport implements ExecutionTransport {
  private messageHandler?: (message: string) => void;
  private disconnectHandler?: () => void;
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    // Simulate socket connection delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  disconnect(): void {
    this.connected = false;
    if (this.disconnectHandler) {
      this.disconnectHandler();
    }
  }

  send(message: string): void {
    if (!this.connected) {
      throw new Error("Cannot send on disconnected transport");
    }
    // Echo back or ignore for now, tests will inspect this
  }

  onMessage(handler: (message: string) => void): void {
    this.messageHandler = handler;
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }

  // Test helpers to simulate backend pushing messages to agent
  public simulateBackendMessage(payload: Record<string, unknown>): void {
    if (this.messageHandler && this.connected) {
      this.messageHandler(JSON.stringify(payload));
    }
  }

  public simulateDisconnect(): void {
    this.disconnect();
  }
}
