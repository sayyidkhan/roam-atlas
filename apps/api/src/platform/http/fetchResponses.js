export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

export function bodyResponse(body, status = 200, headers = {}) {
  return new Response(body, { status, headers });
}

export function redirectResponse(location, status = 302, headers = {}) {
  return new Response(null, {
    status,
    headers: { Location: location, ...headers }
  });
}
