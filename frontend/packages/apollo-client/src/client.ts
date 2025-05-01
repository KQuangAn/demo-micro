import {
  registerApolloClient,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";

export const client = registerApolloClient(() => {
  return new ApolloClient({
    uri: 'http://127.0.0.1:8080/query',
    cache: new InMemoryCache(),
    headers: {
      Authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImEiLCJleHAiOjE3NDYxNTA5NjN9.6T46XLDkTC-Cz-CGevk-iBEq2WViGtezQicUFx_qHeg',
    }
  });
});