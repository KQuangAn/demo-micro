import { GraphQLModule } from '@nestjs/graphql';
import { InventoryModule } from './inventory/inventory.module';
import { Module } from '@nestjs/common';
import { ApolloDriverConfig, ApolloFederationDriver } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { join } from 'path';
import { getEnv } from 'config';
import { DateScalar } from './graphql/date.scalar';

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
      csrfPrevention: false,
      resolvers: {
        Date: DateScalar,
      },
    }),
    // Infrastructure modules
    AuthModule,
    PrismaModule,

    // Core domain module (Clean Architecture with Kafka)
    InventoryModule,
  ],
  providers: [],
})
export class AppModule {}
