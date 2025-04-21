import { Module } from '@nestjs/common';
import { EventBridge } from './eventbridge';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [EventBridge],
  exports: [EventBridge],
})
export class EventBridgeModule {}
