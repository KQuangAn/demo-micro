import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getCurrentUser } from './server/index.js';

const httpLink = createHttpLink({
  uri: 'http://localhost:8080/query',
});

const authLink = setContext(async (_, { headers }) => {
  const auth = await getCurrentUser();
  const token = auth?.user?.token;
  return {
    headers: {
      ...headers,
      Authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
