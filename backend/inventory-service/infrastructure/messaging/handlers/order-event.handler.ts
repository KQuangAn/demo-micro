// Order Event Handlers
// Consumes order events from Kafka and triggers appropriate use cases

import { Injectable, Logger } from '@nestjs/common';
import { ReserveInventoryUseCase } from '../../../application/use-cases/reserve-inventory.use-case';
import { ReleaseInventoryUseCase } from '../../../application/use-cases/release-inventory.use-case';
import { ReserveInventoryCommand } from '../../../application/commands/reserve-inventory.command';
import { ReleaseInventoryCommand } from '../../../application/commands/release-inventory.command';
import { KafkaMessage } from '../kafka.config';

// Event payload interfaces
export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    currency: string;
  }>;
  totalAmount: number;
  currency: string;
  createdAt: Date;
}

export interface OrderCancelledPayload {
  orderId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  reason?: string;
  cancelledAt: Date;
}

export interface OrderUpdatedPayload {
  orderId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  updatedAt: Date;
}

@Injectable()
export class OrderEventHandler {
  private readonly logger = new Logger(OrderEventHandler.name);

  constructor(
    private readonly reserveInventoryUseCase: ReserveInventoryUseCase,
    private readonly releaseInventoryUseCase: ReleaseInventoryUseCase,
  ) {}

  async handleOrderCreated(
    message: KafkaMessage<OrderCreatedPayload>,
  ): Promise<void> {
    try {
      const { orderId, userId, items } = message.payload;

      this.logger.log(`Processing OrderCreated event for order: ${orderId}`);

      // Map order items to reservation command
      const command = new ReserveInventoryCommand(
        userId,
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          currency: item.currency,
        })),
      );

      // Execute reservation use case
      await this.reserveInventoryUseCase.execute(command);

      this.logger.log(`Successfully reserved inventory for order: ${orderId}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle OrderCreated event for order: ${message.payload.orderId}`,
        error,
      );
      // The error will be caught by Kafka consumer and can trigger retry or DLQ
      throw error;
    }
  }

  async handleOrderCancelled(
    message: KafkaMessage<OrderCancelledPayload>,
  ): Promise<void> {
    try {
      const { orderId, items } = message.payload;

      this.logger.log(`Processing OrderCancelled event for order: ${orderId}`);

      const command = new ReleaseInventoryCommand(
        message.payload.userId,
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          reason: 'order_cancelled',
        })),
      );
      await this.releaseInventoryUseCase.execute(command);

      this.logger.log(
        `Successfully released inventory for cancelled order: ${orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle OrderCancelled event for order: ${message.payload.orderId}`,
        error,
      );
      throw error;
    }
  }

  async handleOrderUpdated(
    message: KafkaMessage<OrderUpdatedPayload>,
  ): Promise<void> {
    try {
      const { orderId } = message.payload;

      this.logger.log(`Processing OrderUpdated event for order: ${orderId}`);

      // TODO: Implement logic to adjust inventory based on order changes
      // This might involve comparing old vs new quantities and
      // either reserving more or releasing some inventory

      // Placeholder to satisfy async contract while no await is needed
      await Promise.resolve();

      this.logger.log(
        `Successfully processed OrderUpdated event for order: ${orderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle OrderUpdated event for order: ${message.payload.orderId}`,
        error,
      );
      throw error;
    }
  }
}
