// Application DTO - Data Transfer Object
// Used to transfer data between layers

import { InventoryItem } from '../../domain/entities/inventory-item.entity';
import { Price } from '../../domain/value-objects/price.vo';

export class InventoryItemDto {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly brand: string,
    public readonly description: string,
    public readonly images: string[],
    public readonly categories: string[],
    public readonly quantity: number,
    public readonly price: number,
    public readonly currencyCode: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromDomain(item: InventoryItem, price: Price): InventoryItemDto {
    return new InventoryItemDto(
      item.id,
      item.title,
      item.brand,
      item.description,
      item.images,
      item.categories,
      item.quantity,
      price.amount,
      price.currency.code,
      item.createdAt,
      item.updatedAt,
    );
  }
}
