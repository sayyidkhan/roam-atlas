import { Hono } from "hono";

import type { HonoRouteRegistrar } from "../platform/http/honoRoutes.ts";

type RoamAtlasApiDependencies = {
  routeRegistrars: HonoRouteRegistrar[];
  logger?: Pick<Console, "error">;
};

export function createRoamAtlasApi({
  routeRegistrars,
  logger = console
}: RoamAtlasApiDependencies) {
  const app = new Hono();
  for (const registerRoutes of routeRegistrars) {
    registerRoutes(app);
  }

  app.notFound(() =>
    new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    })
  );

  app.onError((error) => {
    const statusCode = getErrorStatusCode(error);
    if (statusCode >= 500) {
      logger.error("RoamAtlas dev server request failed:", error);
    }
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  });

  return app;
}

function getErrorStatusCode(error: unknown) {
  if (isRecord(error) && error.code === "ENOENT") return 404;
  if (isRecord(error) && error.name === "ZodError") return 400;
  if (isRecord(error)) {
    const statusCode = Number(error.statusCode);
    if (Number.isInteger(statusCode) && statusCode >= 400) {
      return statusCode;
    }
  }
  return 500;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
