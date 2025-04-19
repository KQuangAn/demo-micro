import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { InventoryModule } from './inventory/inventory.module';
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { SqsService } from './sqs/sqs.service';
import { AuthService } from './auth/auth.service';

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    }),
    InventoryModule,
  ],
  providers: [PrismaService, SqsService, AuthService],
})
export class AppModule {}

