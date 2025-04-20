import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryResolver } from './inventory.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBridgeModule } from 'src/eventbridge/eventbridge.module';

@Module({
  imports: [PrismaModule, EventBridgeModule],
  providers: [
    InventoryService,
    InventoryResolver,
  ],
  exports: [InventoryService]
})
export class InventoryModule { }
