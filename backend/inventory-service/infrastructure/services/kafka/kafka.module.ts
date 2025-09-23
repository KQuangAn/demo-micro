// src/infrastructure/kafka/kafka.module.ts
import { Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { KafkaConsumer } from './kafka.consumer';

@Module({
  providers: [KafkaService, KafkaConsumer],
  exports: [KafkaService],
})
export class KafkaModule {}
