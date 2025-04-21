import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SqsClient } from './sqs.client';

@Module({
  imports: [ConfigModule],
  providers: [SqsClient],
  exports: [SqsClient],
})
export class SqsModule {}
