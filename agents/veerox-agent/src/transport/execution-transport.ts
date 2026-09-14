export interface ExecutionTransport {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: string): void;
  onMessage(handler: (message: string) => void): void;
  onDisconnect(handler: () => void): void;
}
