// Kafka Configuration
// Centralized configuration for Kafka connection and topics

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  connectionTimeout?: number;
  requestTimeout?: number;
  /**
   * List of topics this service should subscribe to (inbound streams)
   */
  subscribeTopics?: string[];
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
  // Consolidated outbound stream for all inventory domain events
  INVENTORY_EVENTS: 'inventory.events',

  // Consolidated inbound stream for all order domain events
  ORDER_EVENTS: 'order.events',
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
