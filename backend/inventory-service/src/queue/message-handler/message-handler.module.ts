import { Module } from '@nestjs/common';
import { InventoryModule } from 'src/inventory/inventory.module';
import { InventoryMessageHandler } from './message-handler.implementation';
import { InventoryService } from 'src/inventory/inventory.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventEmitterModule } from 'src/event-emitter/event-emitter.module';

@Module({
  imports: [InventoryModule, PrismaModule, EventEmitterModule],
  providers: [PrismaService, InventoryService, InventoryMessageHandler],
  exports: [PrismaService, InventoryService, InventoryMessageHandler],
})
export class MessageHandlerModule {}
