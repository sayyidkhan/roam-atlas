import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { BrowserRouter } from "react-router";

import { APP_CONFIG } from "../config/appConfig.js";
import { ApplicationStoreProvider } from "./applicationStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: APP_CONFIG.query.staleTimeMs,
      gcTime: APP_CONFIG.query.garbageCollectionTimeMs,
      retry: APP_CONFIG.query.retryCount,
      refetchOnWindowFocus: false
    }
  }
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ApplicationStoreProvider>{children}</ApplicationStoreProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
