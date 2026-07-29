import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import { ApplicationShell } from "./ApplicationShell";

type ApplicationRuntimeModule = {
  applyApplicationRuntimeRoute: (
    pathname: string
  ) => Promise<void>;
  startApplicationRuntime: () => Promise<() => void>;
};

type ApplicationRuntimeHostProps = {
  loadRuntime?: () => Promise<ApplicationRuntimeModule>;
};

let runtimeModuleLoad: Promise<ApplicationRuntimeModule> | null =
  null;

function loadApplicationRuntime(): Promise<ApplicationRuntimeModule> {
  runtimeModuleLoad ??= import("./applicationRuntime");
  return runtimeModuleLoad;
}

export function ApplicationRuntimeHost({
  loadRuntime = loadApplicationRuntime
}: ApplicationRuntimeHostProps) {
  const { pathname } = useLocation();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;
    let stopRuntime: (() => void) | null = null;

    void loadRuntime()
      .then((runtime) => runtime.startApplicationRuntime())
      .then((stop) => {
        if (isDisposed) {
          stop();
          return;
        }
        stopRuntime = stop;
      })
      .catch((error: unknown) => {
        if (isDisposed) return;
        setBootstrapError(
          error instanceof Error
            ? error.message
            : "Could not start RoamAtlas"
        );
      });

    return () => {
      isDisposed = true;
      stopRuntime?.();
    };
  }, [loadRuntime]);

  useEffect(() => {
    let isDisposed = false;

    void loadRuntime()
      .then((runtime) =>
        runtime.applyApplicationRuntimeRoute(pathname)
      )
      .then(() => {
        if (!isDisposed) setBootstrapError(null);
      })
      .catch((error: unknown) => {
        if (isDisposed) return;
        setBootstrapError(
          error instanceof Error
            ? error.message
            : "Could not open this RoamAtlas route"
        );
      });

    return () => {
      isDisposed = true;
    };
  }, [loadRuntime, pathname]);

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
