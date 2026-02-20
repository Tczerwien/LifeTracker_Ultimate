import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,           // ADR-005 SD1
      refetchOnWindowFocus: false,   // ADR-005 SD1
      refetchOnMount: false,         // ADR-005 SD1
      retry: 1,
    },
  },
});
