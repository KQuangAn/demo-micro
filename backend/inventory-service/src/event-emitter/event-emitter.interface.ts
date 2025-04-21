export interface IEventEmitter {
  emit(...args: unknown[]): Promise<unknown>;
}
