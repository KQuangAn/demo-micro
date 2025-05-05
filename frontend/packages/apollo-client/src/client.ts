import { ApolloClient, InMemoryCache } from '@apollo/client';

export const client = new ApolloClient({
  uri: 'http://localhost:8080/query',
  cache: new InMemoryCache(),
  headers: {
    Authorization:
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImEiLCJleHAiOjE3NDY3MTM4NDV9.1x9DwGe4TqAUIa-7GnHupPoodo8RQYDKFfLLZLCl43M',
  },
});
