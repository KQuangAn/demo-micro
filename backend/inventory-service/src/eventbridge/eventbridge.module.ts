import { Module } from '@nestjs/common';
import { EventBridgeService } from './eventbridge.service';
import { EventBridgeHelper } from './eventbridge.helpers';

@Module({
    providers: [EventBridgeService, EventBridgeHelper],
    exports: [EventBridgeService ,EventBridgeHelper],
})
export class EventBridgeModule { }