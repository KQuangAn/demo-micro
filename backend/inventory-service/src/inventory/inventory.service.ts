import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateInventoryInput } from './dto/update-inventory.input';
import { EventBridgeService } from '../eventbridge/eventbridge.service';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private eventBridge: EventBridgeService,
  ) {}

  async updateInventory(data: UpdateInventoryInput) {
    const inventory = await this.prisma.inventory.upsert({
      where: { productId: data.productId },
      update: { quantity: data.quantity },
      create: { ...data },
    });

    await this.eventBridge.publishInventoryUpdated(inventory.productId, inventory.quantity);

    return inventory;
  }
}
