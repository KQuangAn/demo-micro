import { GraphQLModule } from '@nestjs/graphql';
import { InventoryModule } from './inventory/inventory.module';
import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { QueueModule } from './queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { join } from 'path';
import { getEnv } from 'config';
import { EventEmitterModule } from './event-emitter/event-emitter.module';
import { ApolloClientModule } from './apollo-client/apollo-client.module';
import { MessageHandlerModule } from './queue/message-handler/message-handler.module';
import { DateScalar } from './graphql/date.scalar';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [getEnv],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      csrfPrevention: false, // temp
      resolvers: {
        Date: DateScalar, // Register the Date scalar type
      },
    }),
    AuthModule,
    EventEmitterModule,
    MessageHandlerModule,
    PrismaModule,
    ApolloClientModule,
    QueueModule,
    InventoryModule,
  ],
  providers: [],
})
export class AppModule {}
