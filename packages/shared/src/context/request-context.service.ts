import { AsyncLocalStorage } from 'async_hooks';

export class RequestContextService {
  private static als = new AsyncLocalStorage<Map<string, any>>();

  static getStore() {
    return this.als.getStore();
  }

  static getCorrelationId(): string | undefined {
    const store = this.getStore();
    return store?.get('correlationId');
  }

  static run(store: Map<string, any>, callback: () => void) {
    this.als.run(store, callback);
  }
}
