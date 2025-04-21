import { Module } from '@nestjs/common';
import { EventEmitterService } from './event-emitter.service';
import { EventBridge } from './eventbridge/eventbridge';
import { EventBridgeModule } from './eventbridge/eventbridge.module';

@Module({
  imports: [EventBridgeModule],
  providers: [
    EventEmitterService,
    {
      provide: 'EVENT_EMITTER_CLIENT',
      useClass: EventBridge,
    },
  ],
  exports: [EventEmitterService],
})
export class EventEmitterModule {
  // //globally
  // static forRoot(client: Type<any>, module: Type<any>): DynamicModule {
  //   return {
  //     module: EventEmitterModule,
  //     imports: [ConfigModule, module],
  //     providers: [
  //       {
  //         provide: 'EVENT_EMITTER_CLIENT',
  //         useClass: client,
  //       },
  //       EventEmitterService,
  //     ],
  //     exports: [EventEmitterService],
  //   };
  // }
  // // per module
  // static forFeature(client: Type<any>): DynamicModule {
  //   return {
  //     module: EventEmitterModule,
  //     imports: [ConfigModule],
  //     providers: [
  //       {
  //         provide: 'EVENT_EMITTER_CLIENT',
  //         useClass: client,
  //       },
  //       EventEmitterService,
  //     ],
  //     exports: [EventEmitterService, 'EVENT_EMITTER_CLIENT'],
  //   };
  // }
}
