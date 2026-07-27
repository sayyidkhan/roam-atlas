import { watch } from "node:fs";
import path from "node:path";

const DEFAULT_ROUTE_PATH = "/__roamatlas/dev-reload";

export function createLiveReloadServer({
  repositoryRoot,
  routePath = DEFAULT_ROUTE_PATH,
  debounceMs = 120
}) {
  const clients = new Set();
  const encoder = new TextEncoder();
  const htmlScript = `<script>
(() => {
  if (!("EventSource" in window)) return;
  const source = new EventSource("${routePath}");
  source.onmessage = (event) => {
    if (event.data === "reload") window.location.reload();
  };
})();
</script>`;

  function handleRequest(request) {
    let client;
    const stream = new ReadableStream({
      start(controller) {
        client = controller;
        clients.add(controller);
        controller.enqueue(encoder.encode("data: connected\n\n"));
      },
      cancel() {
        if (client) clients.delete(client);
      }
    });
    request.signal.addEventListener(
      "abort",
      () => {
        if (client) clients.delete(client);
      },
      { once: true }
    );
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  }

  function start() {
    const notify = debounce(() => {
      for (const client of clients) {
        try {
          client.enqueue(encoder.encode("data: reload\n\n"));
        } catch {
          clients.delete(client);
        }
      }
    }, debounceMs);
    const watchTargets = [
      path.join(repositoryRoot, "src"),
      path.join(repositoryRoot, "public"),
      path.join(repositoryRoot, "index.html")
    ];

    for (const target of watchTargets) {
      try {
        watch(target, { recursive: true }, (eventType, filename) => {
          if (!filename || filename.endsWith("~")) return;
          if (shouldIgnoreLiveReloadPath(filename)) return;
          notify();
        });
      } catch (error) {
        console.warn(
          `RoamAtlas live reload could not watch ${target}: ${String(
            error?.message ?? error
          )}`
        );
      }
    }
  }

  return { handleRequest, htmlScript, routePath, start };
}

export function shouldIgnoreLiveReloadPath(filename) {
  const normalized = String(filename).replace(/\\/g, "/");
  return (
    normalized.startsWith("country-cards/") ||
    normalized.includes("/country-cards/")
  );
}

function debounce(callback, waitMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), waitMs);
  };
}
