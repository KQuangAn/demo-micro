import { Module, DynamicModule } from '@nestjs/common';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';

@Module({})
export class ApolloClientModule {
  static forFeature(uri: string): DynamicModule {
    const client = new ApolloClient({
      link: new HttpLink({ uri }),
      cache: new InMemoryCache(),
    });

    return {
      module: ApolloClientModule,
      providers: [
        {
          provide: 'APOLLO_CLIENT',
          useValue: client,
        },
      ],
      exports: ['APOLLO_CLIENT'],
    };
  }
}
