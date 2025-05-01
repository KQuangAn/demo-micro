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
import { ReserveInventoryInput } from './dto/reserve.inventory.input';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private eb: EventEmitterService,
  ) { }

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
        EventType.InventoryUpdatedFailed,
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

  async handleReserveInventory(payload: ReserveInventoryInput): Promise<Inventory[] | void> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const productMap = new Map(payload.products.map(p => [p.productId, p]));

        const inventories = await tx.inventory.findMany({
          where: {
            id: { in: [...productMap.keys()] }
          }
        });

        if (inventories.length !== payload.products.length) {
          throw new NotFoundException(`Some products not found in inventory`);
        }

        const priceCriteria = payload.products.map(p => ({
          productId: p.productId,
          currencyName: p.currency,
        }));

        const prices = await tx.prices.findMany({
          where: {
            OR: priceCriteria.map(c => ({
              inventory: { id: c.productId },
              currencies: { name: c.currencyName },
            })),
          },
          include: { currencies: true },
          orderBy: { startDate: 'desc' },
        });

        const latestPriceMap = new Map<string, number>();

        for (const price of prices) {
          const key = `${price.productId}_${price.currencies.name}`;
          if (!latestPriceMap.has(key)) {
            latestPriceMap.set(key, Number(price.price));
          }
        }

        const updatedItems: Inventory[] = [];

        const reservedItems: Array<{
          productId: string;
          quantity: number;
          price: number;
          currency: string;
        }> = [];

        for (const inventory of inventories) {
          const productInput = productMap.get(inventory.id);

          if (!productInput) {
            throw new BadRequestException(`Missing input for product ${inventory.id}`);
          }

          const newQty = inventory.quantity - productInput.quantity;

          if (newQty < 0) {
            throw new BadRequestException(
              `Not enough stock for product ${inventory.id}`
            );
          }

          const inventoryItem = await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: newQty },
          });
          console.log(inventoryItem, 1234123)
          updatedItems.push(inventoryItem);

          const priceKey = `${inventory.id}_${productInput.currency}`;
          const price = latestPriceMap.get(priceKey);

          if (price === undefined) {
            throw new NotFoundException(`Price not found for product ${inventory.id} in currency ${productInput.currency}`);
          }

          reservedItems.push({
            productId: inventoryItem.id,
            quantity: productInput.quantity,
            price,
            currency: productInput.currency,
          });
        }

        await this.eb.emit(
          {
            userId: payload.userId,
            items: reservedItems,
          },
          EventType.InventoryReserved,
        );

        return updatedItems;
      });
    } catch (e) {
      const reason = `Error reserving inventory: ${e}`;
      await this.eb.emit({ ...payload, reason }, EventType.InventoryReservationFailed);
      throw new BadRequestException(`Error reserving inventory`, e);
    }
  }



}
