import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { BrowserRouter } from "react-router";

import { ApplicationStoreProvider } from "./applicationStore";
import { appQueryClient } from "./queryClient";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <QueryClientProvider client={appQueryClient}>
        <ApplicationStoreProvider>{children}</ApplicationStoreProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
