import type {
  FlipbookPoint
} from "@roamatlas/domain/flipbookPage.js";
import {
  HttpRequestError
} from "../../platform/http/readJsonRequest.ts";
import type {
  ClickPhraseRequest
} from "./openAIClickResolver.ts";
import type {
  ExplorerClickPage,
  FlipbookClickBody
} from "./clickResolutionHttpTypes.ts";

export function parseResolveClickBody(
  value: unknown
): ClickPhraseRequest {
  const body = requireRecord(value);
  if (typeof body.sceneId !== "string") {
    throw new HttpRequestError(
      "resolve-click requires sceneId.",
      400
    );
  }
  return body as ClickPhraseRequest;
}

export function parseFlipbookClickBody(
  value: unknown
): FlipbookClickBody {
  const body = requireRecord(value);
  const currentPage = requireRecord(
    body.currentPage,
    "flipbook click requires currentPage."
  );
  const imageClick = isRecord(body.imageClick)
    ? body.imageClick
    : null;
  const normalizedClick =
    readPoint(imageClick?.normalizedImage) ??
    readPoint(body.normalizedClick);
  if (!normalizedClick) {
    throw new HttpRequestError(
      "flipbook click requires normalized image coordinates.",
      400
    );
  }
  return {
    ...(body as Omit<
      FlipbookClickBody,
      "currentPage" | "normalizedClick"
    >),
    currentPage:
      currentPage as ExplorerClickPage,
    normalizedClick
  };
}

function readPoint(
  value: unknown
): FlipbookPoint | null {
  if (!isRecord(value)) return null;
  return typeof value.x === "number" &&
    typeof value.y === "number"
    ? { x: value.x, y: value.y }
    : null;
}

function requireRecord(
  value: unknown,
  message = "Request body must be a JSON object."
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new HttpRequestError(message, 400);
  }
  return value;
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
