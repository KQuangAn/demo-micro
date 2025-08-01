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
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private eb: EventEmitterService,
  ) {}

  async findAll(): Promise<Inventory[]> {
    const inventoryItems = await this.prisma.inventory.findMany({
      include: {
        prices: {
          include: {
            currencies: true,
          },
        },
      },
    });

    return inventoryItems.map((item) => {
      const latestPrice =
        item.prices.length > 0 ? item.prices[item.prices.length - 1] : null;

      return {
        id: item.id,
        title: item.title,
        brand: item.brand,
        description: item.description,
        images: item.images,
        categories: item.categories,
        quantity: item.quantity,
        price: latestPrice ? parseFloat(latestPrice.price.toString()) : 0,
        currencyName: latestPrice ? latestPrice.currencies.name : '',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }
  async findOne(id: string): Promise<Inventory> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id },
      include: {
        prices: {
          include: {
            currencies: true, // Include currency details
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException(`Inventory item with id ${id} not found`);
    }

    const latestPrice =
      inventory.prices.length > 0
        ? inventory.prices[inventory.prices.length - 1]
        : null;

    if (!latestPrice) {
      throw new NotFoundException(
        `No prices found for inventory item with id ${id}`,
      );
    }

    if (!latestPrice.currencies) {
      throw new NotFoundException(
        `No currency found for the latest price of inventory item with id ${id}`,
      );
    }

    return {
      ...inventory,
      price: parseFloat(latestPrice.price.toString()),
      currencyName: latestPrice.currencies.name,
    };
  }

  async create(data: CreateInventoryInput): Promise<Inventory> {
    return await this.prisma.$transaction(async (tx) => {
      const { price, currencyName } = data;

      const validatedData =
        Prisma.validator<Prisma.inventoryCreateInput>()(data);

      const inventoryItem = await tx.inventory.create({
        data: {
          title: data.title,
          brand: data.brand,
          description: data.description,
          images: data.images,
          categories: data.categories,
          quantity: data.quantity,
        },
      });

      const currency = await tx.currencies.findUnique({
        where: { name: currencyName },
      });

      if (!currency) {
        throw Error('Currency not supported');
      }

      const priceDecimal = new Decimal(price);

      const priceRes = await tx.prices.create({
        data: {
          productId: inventoryItem.id,
          price: priceDecimal,
          currencyId: currency.id,
        },
      });

      await this.eb.emit(inventoryItem, EventType.InventoryCreated);

      const final: Inventory = {
        ...inventoryItem,
        price: priceRes.price.toNumber(),
        currencyName: currency.name,
      };

      return final;
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      quantity?: number;
      price?: number; // Include price here
      currencyName?: string; // Include currencyName here
    },
  ): Promise<Inventory> {
    return await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id },
        include: {
          prices: {
            include: {
              currencies: true,
            },
          },
        },
      });

      if (!inventory) {
        throw new NotFoundException(`Inventory item with id ${id} not found`);
      }

      const updatedInventory = await tx.inventory.update({
        where: { id },
        data,
      });

      // Fetch the latest price and currency name
      const latestPrice =
        inventory.prices.length > 0
          ? inventory.prices[inventory.prices.length - 1]
          : null;

      if (!latestPrice) {
        throw new NotFoundException(`No price found for inventory item ${id}`);
      }

      const price = Number(latestPrice.price);
      const currencyName = latestPrice.currencies.name;

      const result: Inventory = {
        ...updatedInventory,
        price,
        currencyName,
      };

      try {
        await this.eb.emit(result, EventType.InventoryUpdated);
      } catch (err) {
        throw new Error(`Failed to emit event: ${err.message}`);
      }

      return result;
    });
  }

  async remove(id: string): Promise<Inventory> {
    return await this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id },
        include: {
          prices: {
            include: {
              currencies: true,
            },
          },
        },
      });

      if (!inventory) {
        throw new NotFoundException(`Inventory item with id ${id} not found`);
      }

      const deletedInventory = await tx.inventory.delete({
        where: { id },
      });

      const latestPrice =
        inventory.prices.length > 0
          ? inventory.prices[inventory.prices.length - 1]
          : null;

      if (!latestPrice) {
        throw new NotFoundException(`No price found for inventory item ${id}`);
      }

      const price = Number(latestPrice.price);
      const currencyName = latestPrice.currencies.name;

      const result: Inventory = {
        ...deletedInventory,
        price,
        currencyName,
      };

      try {
        await this.eb.emit(result, EventType.InventoryDeleted);
      } catch (err) {
        throw new Error(`Failed to emit event: ${err.message}`);
      }

      return result;
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

  async handleReserveInventory(
    payload: ReserveInventoryInput,
  ): Promise<Inventory[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const productMap = new Map(
          payload.products.map((p) => [p.productId, p]),
        );

        const inventories = await tx.inventory.findMany({
          where: {
            id: { in: [...productMap.keys()] },
          },
        });

        if (inventories.length !== payload.products.length) {
          throw new NotFoundException(`Some products not found in inventory`);
        }

        const priceCriteria = payload.products.map((p) => ({
          productId: p.productId,
          currencyName: p.currency,
        }));

        const prices = await tx.prices.findMany({
          where: {
            OR: priceCriteria.map((c) => ({
              inventory: { id: c.productId },
              currencies: { name: c.currencyName },
            })),
          },
          include: { currencies: true },
          orderBy: { startDate: 'desc' },
        });

        const latestPriceMap = new Map<
          string,
          { price: number; currencyName: string }
        >();

        for (const price of prices) {
          const key = `${price.productId}_${price.currencies.name}`;
          if (!latestPriceMap.has(key)) {
            latestPriceMap.set(key, {
              price: Number(price.price),
              currencyName: price.currencies.name,
            });
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
            throw new BadRequestException(
              `Missing input for product ${inventory.id}`,
            );
          }

          const newQty = inventory.quantity - productInput.quantity;

          if (newQty < 0) {
            throw new BadRequestException(
              `Not enough stock for product ${inventory.id}`,
            );
          }

          const priceKey = `${inventory.id}_${productInput.currency}`;
          const priceData = latestPriceMap.get(priceKey);

          if (!priceData) {
            throw new NotFoundException(
              `Price not found for product ${inventory.id} in currency ${productInput.currency}`,
            );
          }

          const inventoryItem = await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: newQty },
          });

          updatedItems.push({
            ...inventoryItem,
            price: priceData.price,
            currencyName: priceData.currencyName,
          });

          reservedItems.push({
            productId: inventoryItem.id,
            quantity: productInput.quantity,
            price: priceData.price,
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
      const reason = `Error reserving inventory: ${e.message || e}`;
      await this.eb.emit(
        { ...payload, reason },
        EventType.InventoryReservationFailed,
      );
      throw new BadRequestException(`Error reserving inventory`, e);
    }
  }
}
