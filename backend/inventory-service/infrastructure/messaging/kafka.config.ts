// Kafka Configuration
// Centralized configuration for Kafka connection and topics

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    maxRetryTime: number;
    initialRetryTime: number;
    retries: number;
  };
}

export interface KafkaTopicConfig {
  topic: string;
  numPartitions?: number;
  replicationFactor?: number;
}

// Kafka Topics used by Inventory Service
export const KAFKA_TOPICS = {
  // Outbound events (published by inventory service)
  INVENTORY_CREATED: 'inventory.created',
  INVENTORY_UPDATED: 'inventory.updated',
  INVENTORY_DELETED: 'inventory.deleted',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
  INVENTORY_RESERVATION_FAILED: 'inventory.reservation.failed',
  INSUFFICIENT_INVENTORY: 'inventory.insufficient',

  // Inbound events (consumed from other services)
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_UPDATED: 'order.updated',
} as const;

export const KAFKA_CONSUMER_GROUPS = {
  INVENTORY_SERVICE: 'inventory-service-group',
} as const;

// Event message interface
export interface KafkaMessage<T = any> {
  eventId: string;
  eventType: string;
  timestamp: Date;
  payload: T;
  metadata?: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
  };
}
