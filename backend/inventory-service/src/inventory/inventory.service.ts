import { Injectable, NotFoundException } from '@nestjs/common';
import { Inventory } from './entities/inventory.entity';
import { CreateInventoryInput } from './dto/create-inventory.input';
import { PrismaService } from '../prisma/prisma.service';
import { EventBridgeService } from 'src/eventbridge/eventbridge.service';
import { EventBridgeHelper } from 'src/eventbridge/eventbridge.helpers';
import { EventType } from 'src/eventbridge/eventbridge.constant';


@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService, private eb: EventBridgeService, private ebHelper: EventBridgeHelper) { }

  async findAll(): Promise<Inventory[]> {
    return this.prisma.inventory.findMany();
  }

  async findOne(id: string): Promise<Inventory> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
    });
    if (!inventory) {
      throw new NotFoundException(`Inventory item with id ${id} not found`);
    }
    return inventory;
  }

  async create(data: CreateInventoryInput): Promise<Inventory> {
    const res = await this.prisma.inventory.create({ data });
    if (res) {
      const event = this.ebHelper.createEvent({ type: EventType.InventoryCreated, payload: res });
      await this.eb.publishEvents(event)
    }
    return res
  }

  async update(id: string, data: { name?: string; description?: string; quantity?: number; price?: number }): Promise<Inventory> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
    });
    if (!inventory) {
      throw new NotFoundException(`Inventory item with id ${id} not found`);
    }

    const res = await this.prisma.inventory.update({
      where: { id },
      data,
    });

    if (res) {
      const event = this.ebHelper.createEvent({ type: EventType.InventoryUpdated, payload: res });
      await this.eb.publishEvents(event)
    }
    return res
  }

  async remove(id: string): Promise<Inventory> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
    });
    if (!inventory) {
      throw new NotFoundException(`Inventory item with id ${id} not found`);
    }
    const res = await this.prisma.inventory.delete({
      where: { id },
    });

    if (res) {
      const event = this.ebHelper.createEvent({ type: EventType.InventoryDeleted, payload: res });
      await this.eb.publishEvents(event)
    }
    return res
  }
}