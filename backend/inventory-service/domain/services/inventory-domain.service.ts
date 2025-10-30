// Domain Service
// Orchestrates complex business logic that doesn't belong to a single entity

import { InventoryItem } from '../entities/inventory-item.entity';

export class InventoryDomainService {
  /**
   * Business logic for bulk reservation
   * Ensures atomic reservation across multiple items
   */
  canReserveMultipleItems(
    items: Map<string, InventoryItem>,
    reservations: Map<string, number>,
  ): { success: boolean; failures: string[] } {
    const failures: string[] = [];

    for (const [itemId, quantity] of reservations.entries()) {
      const item = items.get(itemId);

      if (!item) {
        failures.push(`Item ${itemId} not found`);
        continue;
      }

      if (!item.isAvailable(quantity)) {
        failures.push(
          `Item ${itemId} has insufficient quantity. Available: ${item.quantity}, Requested: ${quantity}`,
        );
      }
    }

    return {
      success: failures.length === 0,
      failures,
    };
  }

  /**
   * Execute bulk reservation
   * This modifies entities but doesn't persist them
   */
  reserveMultipleItems(
    items: Map<string, InventoryItem>,
    reservations: Map<string, number>,
  ): void {
    // First check if all can be reserved
    const validation = this.canReserveMultipleItems(items, reservations);

    if (!validation.success) {
      throw new Error(
        `Cannot reserve items: ${validation.failures.join(', ')}`,
      );
    }

    // Then reserve all
    for (const [itemId, quantity] of reservations.entries()) {
      const item = items.get(itemId);
      if (item) {
        item.reserveQuantity(quantity);
      }
    }
  }

  /**
   * Calculate total value across multiple items
   */
  calculateTotalValue(
    items: InventoryItem[],
    prices: Map<string, number>,
  ): number {
    return items.reduce((total, item) => {
      const price = prices.get(item.id) || 0;
      return total + price * item.quantity;
    }, 0);
  }
}
