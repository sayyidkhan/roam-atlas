import { jsonResponse } from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import type {
  createUsageService
} from "./usageService.ts";

type UsageService = ReturnType<typeof createUsageService>;

export function createUsageRoutes({
  readUsage
}: {
  readUsage: UsageService["read"];
}): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(
      app,
      "GET",
      "/api/usage",
      async () => jsonResponse(await readUsage())
    );
  };
}
