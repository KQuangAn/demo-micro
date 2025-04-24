import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { MessageHandlerModule } from './message-handler/message-handler.module';
import { InventoryMessageHandler } from './message-handler/message-handler.implementation';
import { SqsModule } from './sqs/sqs.module';
import { SqsClient } from './sqs/sqs.client';

@Module({
  imports: [SqsModule, MessageHandlerModule],
  providers: [
    QueueService,
    {
      provide: 'QUEUE_CLIENT',
      useClass: SqsClient,
    },
    {
      provide: 'MESSAGE_HANLDER',
      useClass: InventoryMessageHandler,
    },
  ],
  exports: [QueueService],
})
export class QueueModule {
  // //globally
  // static forRoot(client: unknown): DynamicModule {
  //   return {
  //     module: QueueModule,
  //     providers: [
  //       {
  //         provide: 'QUEUE_CLIENT',
  //         useValue: client,
  //       },
  //       QueueService,
  //     ],
  //     exports: [QueueService, 'QUEUE_CLIENT'],
  //   };
  // }
  // // per module
  // static forFeature(client: Type<any>): DynamicModule {
  //   return {
  //     module: QueueModule,
  //     providers: [
  //       {
  //         provide: 'QUEUE_CLIENT',
  //         useClass: client,
  //       },
  //       QueueService,
  //     ],
  //     exports: [QueueService, 'QUEUE_CLIENT'],
  //   };
  // }
}
