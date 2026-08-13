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
  const [activeRuntime, setActiveRuntime] =
    useState<ApplicationRuntimeModule | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;
    let stopRuntime: (() => void) | null = null;

    void loadRuntime()
      .then(async (runtime) => ({
        runtime,
        stop: await runtime.startApplicationRuntime()
      }))
      .then(({ runtime, stop }) => {
        if (isDisposed) {
          stop();
          return;
        }
        stopRuntime = stop;
        setActiveRuntime(runtime);
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
    if (!activeRuntime) return;
    let isDisposed = false;

    void activeRuntime
      .applyApplicationRuntimeRoute(pathname)
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
  }, [activeRuntime, pathname]);

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
