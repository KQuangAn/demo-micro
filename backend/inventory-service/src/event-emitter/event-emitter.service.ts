import { Inject, Injectable } from '@nestjs/common';
import { IEventEmitter } from './event-emitter.interface';
import { createEvent } from 'src/common/util';
import { EventType } from 'src/common/types';

@Injectable()
export class EventEmitterService implements IEventEmitter {
  constructor(@Inject('EVENT_EMITTER_CLIENT') private client: IEventEmitter) {}

  async emit(res: any, type: EventType) {
    const event = createEvent({
      type: type,
      payload: res,
    });
    console.log(event, 'new emitting event');

    await this.client.emit(event);
  }
}
