export interface EventPublisher {
  publish<T>(routingKey: string, event: T): Promise<void>;
}
