import { PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';
import { EventType, OrdersSchema, TOrders } from './types';

export const createEvent = ({
  type,
  payload,
}: {
  type: EventType;
  payload: unknown;
}): PutEventsRequestEntry[] => {
  const detail = typeof payload === 'string' ? { message: payload } : payload;

  return [
    {
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: process.env.EVENT_BRIDGE_SOURCE,
      DetailType: type,
      Detail:  JSON.stringify(detail),
    },
  ];
};

export const isOrders = (detail: any): detail is TOrders[] => {
  return Array.isArray(detail) || OrdersSchema.safeParse(detail).success;
};
