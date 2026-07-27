import { useEffect, useState } from "react";

import { ApplicationShell } from "./ApplicationShell";

let runtimeStart: Promise<unknown> | null = null;

function startApplicationRuntime() {
  runtimeStart ??= import("./applicationRuntime");
  return runtimeStart;
}

export function ApplicationRuntimeHost() {
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    startApplicationRuntime().catch((error: unknown) => {
      if (!isMounted) return;
      setBootstrapError(error instanceof Error ? error.message : "Could not start RoamAtlas");
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      {bootstrapError ? (
        <p className="react-bootstrap-error" role="alert">
          {bootstrapError}
        </p>
      ) : null}
      <ApplicationShell />
    </>
  );
}
