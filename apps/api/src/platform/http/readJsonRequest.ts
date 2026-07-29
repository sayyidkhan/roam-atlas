const DEFAULT_MAX_BODY_BYTES = 1_048_576;

export type JsonRequestOptions = {
  maxBodyBytes?: number;
};

export class HttpRequestError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HttpRequestError";
    this.statusCode = statusCode;
  }
}

export async function readJsonRequest(
  request: Request,
  {
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES
  }: JsonRequestOptions = {}
): Promise<unknown> {
  const text = await request.text();
  if (
    new TextEncoder().encode(text).byteLength >
    maxBodyBytes
  ) {
    throw new HttpRequestError(
      "JSON request body exceeds the allowed size.",
      413
    );
  }
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpRequestError(
      "Request body must contain valid JSON.",
      400
    );
  }
}
