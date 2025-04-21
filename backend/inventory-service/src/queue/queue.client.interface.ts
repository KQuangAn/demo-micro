export interface IQueueClient {
  recieve(...args: unknown[]): Promise<unknown>;
  delete(...args: unknown[]): Promise<unknown>;
}
