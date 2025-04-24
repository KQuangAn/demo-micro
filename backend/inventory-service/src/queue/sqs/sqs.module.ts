import { Module } from '@nestjs/common';
import { SqsClient } from './sqs.client';

@Module({
  imports: [],
  providers: [SqsClient],
  exports: [SqsClient],
})
export class SqsModule {}
