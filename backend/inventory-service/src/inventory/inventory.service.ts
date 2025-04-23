import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Inventory } from './entities/inventory.entity';
import { CreateInventoryInput } from './dto/create-inventory.input';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitterService } from 'src/event-emitter/event-emitter.service';
import { EventType, TOrders } from 'src/common/types';
import { ApolloClient, gql } from '@apollo/client/core';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private eb: EventEmitterService,
    @Inject('APOLLO_CLIENT') private readonly client: ApolloClient<any>,
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
    const validatedData = Prisma.validator<Prisma.inventoryCreateInput>()(data);

    return await this.prisma.$transaction(async (tx) => {
      const res = await tx.inventory.create({
        data: { ...validatedData, updatedAt: new Date() },
      });

      try {
        await this.eb.emit(res, EventType.InventoryCreated);
      } catch (err) {
        throw new Error(`Failed to emit event: ${err.message}`);
      }

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

  async handleOrderCancelled(messageDetail: TOrders[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of messageDetail) {
        const { productId, quantity } = item;

        const inventoryItem = await tx.inventory.findUnique({
          where: { id: productId },
        });

        if (!inventoryItem) {
          throw new NotFoundException(
            `Inventory item with id ${productId} not found`,
          );
        }

        const updatedQuantity = inventoryItem.quantity + quantity;
        await tx.inventory.update({
          where: { id: productId },
          data: { quantity: updatedQuantity },
        });
      }
    });

    for (const item of messageDetail) {
      await this.eb.emit(
        { productId: item.productId, quantity: item.quantity },
        EventType.InventoryUpdated,
      );
    }
  }


  async handleOrderUpdated(messageDetail: TOrders[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of messageDetail) {
        const { id: ordersId, productId, quantity } = item;

        const inventoryItem = await tx.inventory.findUnique({
          where: { id: productId },
        });

        if (!inventoryItem) {
          throw new NotFoundException(
            `Inventory item with id ${productId} not found`,
          );
        }

        const query = gql`
          query GetOrder($id: String!) {
            order(id: $id) {
              id
              productId
              quantity
              status
            }
          }
        `;

        const response = await this.client.query({
          query,
          variables: { id: ordersId },
        });

        const updatedQuantity =
          inventoryItem.quantity + (quantity - response.data.order.quantity);

        await tx.inventory.update({
          where: { id: productId },
          data: { quantity: updatedQuantity },
        });
      }
    });

    for (const item of messageDetail) {
      await this.eb.emit(
        { productId: item.productId, quantity: item.quantity },
        EventType.InventoryUpdated,
      );
    }
  }

  async handleOrderCreated(messageDetail: TOrders[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of messageDetail) {
        const { productId, quantity } = item;

        const inventoryItem = await tx.inventory.findUnique({
          where: { id: productId },
        });

        if (!inventoryItem) {
          throw new NotFoundException(
            `Inventory item with id ${productId} not found`,
          );
        }

        const updatedQuantity = inventoryItem.quantity - quantity;
        await tx.inventory.update({
          where: { id: productId },
          data: { quantity: updatedQuantity },
        });
      }
    });

    for (const item of messageDetail) {
      const { productId, quantity } = item;
      await this.eb.emit(
        { productId, quantity },
        EventType.InventoryReserved,
      ).catch(async () => {
        await this.eb.emit(messageDetail, EventType.InventoryReservationFailed);
        throw new Error('Failed to emit InventoryReserved event');
      });
    }
  }

}
