export interface EventConsumer {
  consume(queue: string, callback: (msg: unknown) => Promise<void>): Promise<void>;
}
