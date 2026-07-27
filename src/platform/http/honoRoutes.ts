import type { Handler, Hono } from "hono";

export type RoamAtlasApp = Hono;
export type HonoRouteRegistrar = (app: RoamAtlasApp) => void;

export type HonoHttpMethod =
  | "DELETE"
  | "GET"
  | "HEAD"
  | "OPTIONS"
  | "PATCH"
  | "POST"
  | "PUT";

export function registerHonoRoute(
  app: RoamAtlasApp,
  methods: HonoHttpMethod | HonoHttpMethod[],
  pathname: string,
  handler: Handler
) {
  app.on(
    Array.isArray(methods) ? methods : [methods],
    pathname,
    handler
  );
}
