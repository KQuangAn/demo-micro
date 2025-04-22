import { forwardRef, Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryResolver } from './inventory.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { EventEmitterModule } from 'src/event-emitter/event-emitter.module';
import { ApolloClientModule } from 'src/apollo-client/apollo-client.module';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule,
    ApolloClientModule.forFeature(process.env.ORDERS_URL || ''),
  ],
  providers: [InventoryService, InventoryResolver],
  exports: [InventoryService],
})
export class InventoryModule {}
