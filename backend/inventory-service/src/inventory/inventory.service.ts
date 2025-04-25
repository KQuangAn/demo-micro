import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inventory } from './entities/inventory.entity';
import { CreateInventoryInput } from './dto/create-inventory.input';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitterService } from 'src/event-emitter/event-emitter.service';
import { EventType, TOrders } from 'src/common/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private eb: EventEmitterService,
  ) {}

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
    return await this.prisma.$transaction(async (tx) => {
      const validatedData =
        Prisma.validator<Prisma.inventoryCreateInput>()(data);

      const res = await tx.inventory.create({
        data: { ...validatedData, updatedAt: new Date() },
      });

      await this.eb.emit(res, EventType.InventoryCreated);

      return res;
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      quantity?: number;
      price?: number;
    },
  ): Promise<Inventory> {
    return await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id },
      });
      if (!inventory) {
        throw new NotFoundException(`Inventory item with id ${id} not found`);
      }

      const res = await tx.inventory.update({
        where: { id },
        data,
      });

      await this.eb.emit(res, EventType.InventoryUpdated).catch((err) => {
        throw new Error(`Failed to emit event: ${err.message}`);
      });

      return res;
    });
  }

  async remove(id: string): Promise<Inventory> {
    return await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id },
      });
      if (!inventory) {
        throw new NotFoundException(`Inventory item with id ${id} not found`);
      }

      const res = await tx.inventory.delete({
        where: { id },
      });

      await this.eb.emit(res, EventType.InventoryDeleted).catch((err) => {
        throw new Error(`Failed to emit event: ${err.message}`);
      });

      return res;
    });
  }

  async handleOrderCancelled(payload: TOrders): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const { productId, quantity } = payload;

        const inventoryItem = await tx.inventory.findUnique({
          where: { id: productId },
        });

        if (!inventoryItem) {
          throw new NotFoundException(
            `Inventory item with id ${productId} not found`,
          );
        }

        const updatedQuantity = inventoryItem.quantity + quantity;
        const res = await tx.inventory.update({
          where: { id: productId },
          data: { quantity: updatedQuantity },
        });

        if (!res) {
          throw new BadRequestException(
            `Inventory item with id ${productId} not found`,
          );
        }
        await this.eb.emit({ ...payload }, EventType.InventoryUpdated);
      });
    } catch (e) {
      const reason = `Error reserving inventory :${e}`;
      await this.eb.emit(
        { ...payload, reason },
        EventType.InventoryReservationFailed,
      );
      throw new BadRequestException(`Error reserving inventory`, e);
    }
  }

  async handleOrderUpdated(payload: TOrders): Promise<void | Inventory> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const { productId, quantity } = payload;

        const inventoryItem = await tx.inventory.findUnique({
          where: { id: productId },
        });

        if (!inventoryItem) {
          throw new NotFoundException(
            `Inventory item with id ${productId} not found`,
          );
        }

        const updatedQuantity = inventoryItem.quantity - quantity;

        const res = await tx.inventory.update({
          where: { id: productId },
          data: { quantity: updatedQuantity },
        });

        if (!res) {
          throw new BadRequestException(`Error updating inventory`);
        }

        await this.eb.emit({ ...payload }, EventType.InventoryUpdated);

        return res;
      });
    } catch (e) {
      const reason = `Error reserving inventory :${e}`;
      await this.eb.emit(
        { ...payload, reason },
        EventType.InventoryReservationFailed,
      );
      throw new BadRequestException(`Error reserving inventory`, e);
    }
  }

  async handleOrderCreated(payload: TOrders): Promise<Inventory | void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const { productId, quantity } = payload;

        const inventoryItem = await tx.inventory.findUnique({
          where: { id: productId },
        });

        if (!inventoryItem) {
          throw new NotFoundException(
            `Inventory item with id ${productId} not found`,
          );
        }

        const updatedQuantity = inventoryItem.quantity - quantity;
        if (updatedQuantity < 0) {
          throw new BadRequestException(`Inventory dont have enough stock!`);
        }

        const res = await tx.inventory.update({
          where: { id: productId },
          data: { quantity: updatedQuantity },
        });

        if (!res) {
          throw new BadRequestException(`Error updating inventory`);
        }

        await this.eb.emit(
          { orderId: payload.id, ...res },
          EventType.InventoryReserved,
        );

        return res;
      });
    } catch (e) {
      const reason = `Error reserving inventory :${e}`;
      await this.eb.emit(
        { ...payload, reason },
        EventType.InventoryReservationFailed,
      );
      throw new BadRequestException(`Error reserving inventory`, e);
    }
  }
}
