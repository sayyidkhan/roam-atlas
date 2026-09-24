import { jsonResponse } from "../../platform/http/fetchResponses.ts";
import {
  registerHonoRoute,
  type HonoRouteRegistrar
} from "../../platform/http/honoRoutes.ts";
import {
  HttpRequestError,
  readJsonRequest
} from "../../platform/http/readJsonRequest.ts";
import type { LeafStudyEnrichedNote } from "./leafStudyEnrichmentPolicy.ts";

type LeafStudyHttpDependencies = {
  enrichLeafStudy: (input: {
    countrySlug: string;
    nodeId: string;
  }) => Promise<LeafStudyEnrichedNote[]>;
};

export function createLeafStudyRoutes({
  enrichLeafStudy
}: LeafStudyHttpDependencies): HonoRouteRegistrar {
  return (app) => {
    registerHonoRoute(app, "POST", "/api/leaf-study", async (context) => {
      try {
        const body = await readJsonRequest(context.req.raw);
        const countrySlug = readField(body, "countrySlug").toLowerCase();
        const nodeId = readField(body, "nodeId");
        if (!countrySlug || !nodeId) {
          return jsonResponse(
            { error: "countrySlug and nodeId are required." },
            400
          );
        }
        const notes = await enrichLeafStudy({ countrySlug, nodeId });
        return jsonResponse({ notes });
      } catch (error) {
        const status = error instanceof HttpRequestError
          ? error.statusCode
          : 500;
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Leaf study failed." },
          status
        );
      }
    });
  };
}

function readField(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return String((value as Record<string, unknown>)[key] ?? "").trim();
}
