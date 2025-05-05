import { ApolloClient, InMemoryCache } from '@apollo/client';

export const client = new ApolloClient({
  uri: 'http://localhost:8080/query',
  cache: new InMemoryCache(),
  headers: {
    Authorization:
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImEiLCJleHAiOjE3NDY2ODg5MTJ9.36SY3bIUNLSidVTqq9z8UXkuUWliKF0Frs0uYqkD1_A',
  },
});
