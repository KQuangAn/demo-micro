export interface IMessageHandler {
  process(detail: any): Promise<unknown>;
}
