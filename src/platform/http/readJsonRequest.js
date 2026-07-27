const DEFAULT_MAX_BODY_BYTES = 1_048_576;

export async function readJsonRequest(
  request,
  { maxBodyBytes = DEFAULT_MAX_BODY_BYTES } = {}
) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBodyBytes) {
    const error = new Error("JSON request body exceeds the allowed size.");
    error.statusCode = 413;
    throw error;
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("Request body must contain valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}
