import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryResolver } from './inventory.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { EventEmitterModule } from 'src/event-emitter/event-emitter.module';

@Module({
  imports: [PrismaModule, EventEmitterModule],
  providers: [InventoryService, InventoryResolver],
  exports: [InventoryService],
})
export class InventoryModule {}
