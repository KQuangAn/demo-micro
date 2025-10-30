// Prisma Repository Implementation
// Implements the domain repository interface

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IInventoryRepository } from '../../domain/repositories/inventory.repository.interface';
import { InventoryItem } from '../../domain/entities/inventory-item.entity';
import { Price, Currency } from '../../domain/value-objects/price.vo';

@Injectable()
export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<InventoryItem | null> {
    const data = await this.prisma.inventory.findUnique({
      where: { id },
    });

    if (!data) {
      return null;
    }

    return this.toDomain(data);
  }

  async findAll(): Promise<InventoryItem[]> {
    const items = await this.prisma.inventory.findMany();
    return items.map((item) => this.toDomain(item));
  }

  async findByIds(ids: string[]): Promise<InventoryItem[]> {
    const items = await this.prisma.inventory.findMany({
      where: {
        id: { in: ids },
      },
    });

    return items.map((item) => this.toDomain(item));
  }

  async save(item: InventoryItem): Promise<void> {
    const data = this.toPrisma(item);

    await this.prisma.inventory.upsert({
      where: { id: item.id },
      create: data,
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.inventory.delete({
      where: { id },
    });
  }

  async getLatestPrice(
    itemId: string,
    currencyCode: string,
  ): Promise<Price | null> {
    const priceData = await this.prisma.prices.findFirst({
      where: {
        productId: itemId,
        currencies: {
          name: currencyCode,
        },
      },
      include: {
        currencies: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    if (!priceData || !priceData.currencies) {
      return null;
    }

    const currency = Currency.create(
      priceData.currencies.name,
      priceData.currencies.name,
      '$', // Should get from currency data
    );

    return Price.create(Number(priceData.price), currency);
  }

  async savePrice(itemId: string, price: Price): Promise<void> {
    const currency = await this.prisma.currencies.findUnique({
      where: { name: price.currency.code },
    });

    if (!currency) {
      throw new Error(`Currency ${price.currency.code} not found`);
    }

    await this.prisma.prices.create({
      data: {
        productId: itemId,
        price: price.amount,
        currencyId: currency.id,
        startDate: new Date(),
      },
    });
  }

  // Mappers: Convert between domain and persistence models
  private toDomain(data: any): InventoryItem {
    return InventoryItem.reconstitute({
      id: data.id,
      title: data.title,
      brand: data.brand,
      description: data.description,
      images: data.images,
      categories: data.categories,
      quantity: data.quantity,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  private toPrisma(item: InventoryItem): any {
    return {
      id: item.id,
      title: item.title,
      brand: item.brand,
      description: item.description,
      images: item.images,
      categories: item.categories,
      quantity: item.quantity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}
