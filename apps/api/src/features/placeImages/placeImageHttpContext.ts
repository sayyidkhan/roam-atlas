import {
  jsonResponse
} from "../../platform/http/fetchResponses.ts";
import {
  readJsonRequest
} from "../../platform/http/readJsonRequest.ts";
import type {
  PlaceImageCountry
} from "./placeImageServiceTypes.ts";
import type {
  PlaceImageHttpDependencies
} from "./placeImageHttpTypes.ts";

export type PlaceImageHttpContext =
  PlaceImageHttpDependencies & {
    findCountry: (
      value: unknown
    ) => PlaceImageCountry | null | undefined;
  };

export function createPlaceImageHttpContext(
  dependencies: PlaceImageHttpDependencies
): PlaceImageHttpContext {
  return {
    ...dependencies,
    findCountry(value) {
      return dependencies.getCountryBySlug(
        String(value ?? "")
          .trim()
          .toLowerCase()
      );
    }
  };
}

export function normalizePlace(
  value: unknown
): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function normalizeContext(
  value: unknown
): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function normalizeKind(
  value: unknown
): string {
  return (
    String(value ?? "region")
      .replace(/[^a-z-]/gi, "")
      .trim()
      .toLowerCase()
      .slice(0, 32) || "region"
  );
}

export function mappedPlaceRequiredResponse():
Response {
  return jsonResponse(
    {
      error:
        "A country and a mapped place are required."
    },
    400
  );
}

export function savedPhotoRequiredResponse():
Response {
  return jsonResponse(
    {
      error:
        "A country, place, and saved photo are required."
    },
    400
  );
}

export async function readRequestObject(
  request: Request
): Promise<Record<string, unknown>> {
  const value = await readJsonRequest(request);
  return isRecord(value) ? value : {};
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
