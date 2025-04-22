import { ApolloClient, InMemoryCache } from '@apollo/client';

export const ordersClient = new ApolloClient({
  uri: process.env.NEXT_PUBLIC_ORDERS_ENDPOINT,
  cache: new InMemoryCache(),
});

export const inventoryClient = new ApolloClient({
  uri: process.env.NEXT_PUBLIC_INVENTORY_ENDPOINT,
  cache: new InMemoryCache(),
});

export const notificationClient = new ApolloClient({
  uri: process.env.NEXT_PUBLIC_NOTIFICATION_ENDPOINT,
  cache: new InMemoryCache(),
});
