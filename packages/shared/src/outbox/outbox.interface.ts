export interface OutboxMessage {
  id: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  payload: string;
  createdAt: Date;
  processedAt: Date | null;
}

export interface OutboxPublisher {
  publishPending(): Promise<void>;
}
