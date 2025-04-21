export interface IQueueService {
  pollMessages(...args: unknown[]): unknown;
}
