import { QueryClient } from "@tanstack/react-query";

import { APP_CONFIG } from "../config/appConfig.js";

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: APP_CONFIG.query.garbageCollectionTimeMs,
      refetchOnWindowFocus: false,
      retry: APP_CONFIG.query.retryCount,
      staleTime: APP_CONFIG.query.staleTimeMs
    }
  }
});
