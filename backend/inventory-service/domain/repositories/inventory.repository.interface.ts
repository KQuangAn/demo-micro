// Repository Interface (Port)
// Defines what we need from persistence, not how it's implemented
// This belongs to the domain layer

import { InventoryItem } from '../entities/inventory-item.entity';
import { Price } from '../value-objects/price.vo';

export interface IInventoryRepository {
  findById(id: string): Promise<InventoryItem | null>;
  findAll(): Promise<InventoryItem[]>;
  findByIds(ids: string[]): Promise<InventoryItem[]>;
  save(item: InventoryItem): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Price-related operations
  getLatestPrice(itemId: string, currencyCode: string): Promise<Price | null>;
  savePrice(itemId: string, price: Price): Promise<void>;
}

export interface IPriceRepository {
  getLatestPrice(itemId: string, currencyCode: string): Promise<Price | null>;
  getPriceHistory(itemId: string, currencyCode: string): Promise<Price[]>;
  savePrice(itemId: string, price: Price): Promise<void>;
}
