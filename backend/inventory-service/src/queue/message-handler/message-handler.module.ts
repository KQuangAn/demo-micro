import { forwardRef, Module } from '@nestjs/common';
import { InventoryModule } from 'src/inventory/inventory.module';
import { InventoryMessageHandler } from './message-handler.implementation';
import { InventoryService } from 'src/inventory/inventory.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventEmitterModule } from 'src/event-emitter/event-emitter.module';
import { ApolloClientModule } from 'src/apollo-client/apollo-client.module';

@Module({
  imports: [
    InventoryModule,
    PrismaModule,
    EventEmitterModule,
    ApolloClientModule.forFeature(process.env.ORDERS_URL || ''),
  ],
  providers: [PrismaService, InventoryService, InventoryMessageHandler],
  exports: [PrismaService, InventoryService, InventoryMessageHandler],
})
export class MessageHandlerModule {}
