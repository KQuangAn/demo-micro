import { Injectable } from '@nestjs/common';
import { EventType } from './eventbridge.constant';
import { PutEventsRequestEntry } from '@aws-sdk/client-eventbridge';

@Injectable()
export class EventBridgeHelper {

    createEvent({ type, payload }: { type: EventType, payload: unknown }): PutEventsRequestEntry[] {
        return [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: process.env.EVENT_BUS_NAME,
            DetailType: type,
            Detail: JSON.stringify(payload),
        }]

    }
}
