import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryResolver } from './inventory.resolver';
import { EventBridgeService } from '../eventbridge/eventbridge.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [
    InventoryService,
    InventoryResolver,
    EventBridgeService,
    PrismaService,
  ],
})
export class InventoryModule {}
