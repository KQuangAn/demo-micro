import { PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { EventType } from './types';

export const createEvent = ({
  type,
  payload,
}: {
  type: EventType;
  payload: unknown;
}): PutEventsRequestEntry[] => {
  return [
    {
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: process.env.EVENT_BUS_NAME,
      DetailType: type,
      Detail: JSON.stringify(payload),
    },
  ];
};
