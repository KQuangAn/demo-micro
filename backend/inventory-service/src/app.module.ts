import { GraphQLModule } from '@nestjs/graphql';
import { InventoryModule } from './inventory/inventory.module';
import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { QueueModule, SQSModule } from './queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { join } from 'path';
import { getEnv } from 'config';

@Module({
  imports: [
    ConfigModule.forRoot(
      {
        isGlobal: true,
        load: [getEnv]
      }
    ),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
    }),
    InventoryModule,
    QueueModule, AuthModule, PrismaModule
  ],
  providers: [],
})
export class AppModule { }

