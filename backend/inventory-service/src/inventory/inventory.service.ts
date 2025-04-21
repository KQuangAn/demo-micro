import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Inventory } from './entities/inventory.entity';
import { CreateInventoryInput } from './dto/create-inventory.input';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitterService } from 'src/event-emitter/event-emitter.service';
import { EventType, TOrders } from 'src/common/types';
import { ApolloClient, gql } from '@apollo/client/core';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private eb: EventEmitterService,
    @Inject('APOLLO_CLIENT') private readonly client: ApolloClient<any>,
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
    const res = await this.prisma.inventory.create({ data });
    if (res) {
      await this.eb.emit(res, EventType.InventoryCreated);
    }
    return res;
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
      await this.eb.emit(res, EventType.InventoryUpdated);
    }
    return res;
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
      await this.eb.emit(res, EventType.InventoryDeleted);
    }
    return res;
  }

  async handleOrderCancelled(orderDetails: {
    items: { productId: string; quantity: number }[];
  }): Promise<void> {
    for (const item of orderDetails.items) {
      const { productId, quantity } = item;

      const inventoryItem = await this.prisma.inventory.findUnique({
        where: { id: productId },
      });

      if (!inventoryItem) {
        throw new NotFoundException(
          `Inventory item with id ${productId} not found`,
        );
      }

      const updatedQuantity = inventoryItem.quantity + quantity;
      await this.prisma.inventory.update({
        where: { id: productId },
        data: { quantity: updatedQuantity },
      });

      await this.eb.emit(
        { productId, quantity: updatedQuantity },
        EventType.InventoryUpdated,
      );
    }
  }

  async handleOrderUpdated(messageDetail: TOrders[]): Promise<void> {
    for (const item of messageDetail) {
      const { id: ordersId, productId, quantity } = item;

      // Find the inventory item
      const inventoryItem = await this.prisma.inventory.findUnique({
        where: { id: productId },
      });

      if (!inventoryItem) {
        throw new NotFoundException(
          `Inventory item with id ${productId} not found`,
        );
      }
      const query = gql`
        query {
          order(id: $id) {
            id
            productId
            quantity
            status
          }
        }
      `;

      //get prev order
      const response = await this.client.query({
        query,
        variables: { id: ordersId },
      });

      // Update the inventory quantity
      const updatedQuantity =
        inventoryItem.quantity + (quantity - response.data.order.quantity);

      //update inventory
      await this.prisma.inventory.update({
        where: { id: productId },
        data: { quantity: updatedQuantity },
      });

      // Optionally emit an event that inventory has been updated
      await this.eb.emit(
        { productId, quantity: updatedQuantity },
        EventType.InventoryUpdated,
      );
    }
  }

  async handleOrderCreated(messageDetail: TOrders[]): Promise<void> {
    for (const item of messageDetail) {
      const { productId, quantity } = item;

      const inventoryItem = await this.prisma.inventory.findUnique({
        where: { id: productId },
      });

      if (!inventoryItem) {
        throw new NotFoundException(
          `Inventory item with id ${productId} not found`,
        );
      }

      const updatedQuantity = inventoryItem.quantity - quantity;
      await this.prisma.inventory.update({
        where: { id: productId },
        data: { quantity: updatedQuantity },
      });

      await this.eb.emit(
        { productId, quantity: updatedQuantity },
        EventType.InventoryUpdated,
      );
    }
  }
}
