import { Test, TestingModule } from '@nestjs/testing';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { EventBridgeService } from './eventbridge.service';

jest.mock('@aws-sdk/client-eventbridge');

describe('EventBridgeService', () => {
  let service: EventBridgeService;
  let client: EventBridgeClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBridgeService],
    }).compile();

    service = module.get<EventBridgeService>(EventBridgeService);
    client = new EventBridgeClient({ region: process.env.AWS_REGION });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publishEvents', () => {
    it('should call PutEventsCommand with the correct parameters', async () => {
      const events = [
        {
          Source: 'test.source',
          DetailType: 'test.detail',
          Detail: JSON.stringify({ key: 'value' }),
          EventBusName: 'default',
        },
      ];

      await service.publishEvents(events);

      expect(PutEventsCommand).toHaveBeenCalledWith({
        Entries: events,
      });
      expect(client.send).toHaveBeenCalledWith(expect.any(PutEventsCommand));
    });
  });
});