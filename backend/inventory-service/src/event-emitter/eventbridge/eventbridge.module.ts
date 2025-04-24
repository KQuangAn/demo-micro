import { Module } from '@nestjs/common';
import { EventBridge } from './eventbridge';

@Module({
  imports: [],
  providers: [EventBridge],
  exports: [EventBridge],
})
export class EventBridgeModule {}
