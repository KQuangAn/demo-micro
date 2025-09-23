// src/infrastructure/kafka/kafka.service.ts
import { Injectable } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { kafkaConfig } from './kafka.config';

@Injectable()
export class KafkaService {
  private kafka = new Kafka(kafkaConfig);
  private producer = this.kafka.producer();

  async onModuleInit() {
    await this.producer.connect();
  }

  async sendMessage(topic: string, message: any) {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });
  }
}
