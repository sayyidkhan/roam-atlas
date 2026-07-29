export function jsonResponse(
  payload: unknown,
  status = 200,
  headers: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...Object.fromEntries(new Headers(headers).entries())
    }
  });
}

export function bodyResponse(
  body: BodyInit | null,
  status = 200,
  headers: HeadersInit = {}
): Response {
  return new Response(body, { status, headers });
}

export function redirectResponse(
  location: string,
  status = 302,
  headers: HeadersInit = {}
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Location", location);
  return new Response(null, {
    status,
    headers: responseHeaders
  });
}
