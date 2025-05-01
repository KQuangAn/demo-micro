import { GraphQLModule } from '@nestjs/graphql';
import { InventoryModule } from './inventory/inventory.module';
import { Module } from '@nestjs/common';
import {
  ApolloDriver,
  ApolloDriverConfig,
  ApolloFederationDriver,
} from '@nestjs/apollo';
import { QueueModule } from './queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { join } from 'path';
import { getEnv } from 'config';
import { EventEmitterModule } from './event-emitter/event-emitter.module';
import { MessageHandlerModule } from './queue/message-handler/message-handler.module';
import { DateScalar } from './graphql/date.scalar';
// import { DecimalScalar } from './graphql/decimal.scalar';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => getEnv()],
      envFilePath: join(__dirname, '..', '.env'),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        federation: 2,
        path: join(process.cwd(), 'src/schema.gql'),
      },
      csrfPrevention: false, // temp
      resolvers: {
        Date: DateScalar,
       // Decimal: DecimalScalar
      },
    }),
    AuthModule,
    EventEmitterModule,
    MessageHandlerModule,
    PrismaModule,
    QueueModule,
    InventoryModule,
  ],
  providers: [],
})
export class AppModule {}
