'use client';

import { ApolloProvider } from '@apollo/client';
import { client } from '@repo/apollo-client';
import { useState, useEffect } from 'react';

export default function ApolloProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
