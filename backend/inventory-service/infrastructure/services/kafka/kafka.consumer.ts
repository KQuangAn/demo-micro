// src/infrastructure/kafka/kafka.consumer.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { kafkaConfig } from './kafka.config';

@Injectable()
export class KafkaConsumer implements OnModuleInit {
  private kafka = new Kafka(kafkaConfig);
  private consumer: Consumer = this.kafka.consumer({ groupId: 'my-group' });

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: 'inventory-topic',
      fromBeginning: true,
    });

    await this.consumer.run({
      eachMessage: ({ message }) => {
        const body = message.value ? message.value.toString() : '';
        console.log(`Received message: ${body}`);
        // Here, you can call a service to process the message
        return Promise.resolve();
      },
    });
  }
}
