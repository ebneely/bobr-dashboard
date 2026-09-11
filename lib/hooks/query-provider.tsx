'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from './query-client';

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // On the server, always a fresh client — one shared between requests would
  // leak one user's data into another's render.
  if (typeof window === 'undefined') return makeQueryClient();
  // In the browser, reuse one so a suspending render does not throw the cache
  // away and refetch everything.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(getQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
