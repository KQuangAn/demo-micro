export interface IQueueService {
    receiveMessages(queueUrl: string): Promise<any>;
    pollMessages(): void;
}