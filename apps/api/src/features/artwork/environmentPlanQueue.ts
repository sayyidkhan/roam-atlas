import path from "node:path";

import {
  ENVIRONMENT_PLAN_PROMPT_VERSION,
  ENVIRONMENT_PLAN_SCHEMA_VERSION
} from "@roamatlas/prompts/buildEnvironmentPlanPrompt.js";
import {
  isPathInside
} from "../../platform/runtime/runtimeCacheFiles.ts";
import type {
  ArtworkJobRepository,
  ArtworkJobRecord
} from "./artworkJobRepository.ts";
import type {
  EnvironmentPage,
  EnvironmentTargetPlan
} from "../explorer/environmentPlanServerTypes.ts";

export type EnvironmentArtworkPage =
  EnvironmentPage & Record<string, unknown>;

export type EnvironmentRuntimePaths = {
  environmentPath: string;
  environmentUrl: string;
};

export type EnvironmentPlan =
  EnvironmentTargetPlan &
  Record<string, unknown> & {
    imageUrl?: unknown;
    promptVersion?: unknown;
    status?: string | null;
    version?: unknown;
  };

type EnvironmentPlanTask = {
  jobPath: string;
  page: EnvironmentArtworkPage;
  paths: EnvironmentRuntimePaths;
};

type ActiveEnvironmentTask = {
  controller: AbortController;
  done: Promise<void>;
  environmentPath: string;
};

type EnvironmentPlanQueueDependencies = {
  createEnvironmentPlan(
    page: EnvironmentArtworkPage,
    options: {
      signal: AbortSignal | null;
    }
  ): Promise<EnvironmentPlan>;
  createFallbackPlan(
    page: EnvironmentArtworkPage,
    reason: string
  ): EnvironmentPlan;
  hasExpectedTargets(
    page: EnvironmentArtworkPage,
    plan: EnvironmentPlan
  ): boolean;
  isPathBeingFlushed: (
    artifactPath: string
  ) => boolean;
  jobRepository: Pick<
    ArtworkJobRepository,
    | "readEnvironment"
    | "readJob"
    | "writeJob"
    | "writeJsonArtifact"
  >;
  logger?: Pick<Console, "error">;
};

export function createEnvironmentPlanQueue({
  jobRepository,
  createEnvironmentPlan,
  createFallbackPlan,
  hasExpectedTargets,
  isPathBeingFlushed,
  logger = console
}: EnvironmentPlanQueueDependencies) {
  const pendingPlans =
    new Map<string, EnvironmentPlanTask>();
  let processorActive = false;
  let activeTask:
    | ActiveEnvironmentTask
    | null = null;

  async function ensurePlan(
    page: EnvironmentArtworkPage,
    paths: EnvironmentRuntimePaths,
    {
      signal = null,
      jobPath = paths.environmentPath
    }: {
      jobPath?: string;
      signal?: AbortSignal | null;
    } = {}
  ): Promise<EnvironmentPlan | null> {
    if (!page.imageUrl) return null;
    throwIfAborted(signal);
    const existing = await findMatchingPlan(
      page,
      paths
    );
    if (existing) return existing;

    let plan: EnvironmentPlan;
    try {
      plan = await createEnvironmentPlan(page, {
        signal
      });
    } catch (error) {
      throwIfAborted(signal);
      plan = createFallbackPlan(
        page,
        errorMessage(error)
      );
    }
    throwIfAborted(signal);
    await jobRepository.writeJsonArtifact(
      paths.environmentPath,
      plan,
      jobPath
    );
    return plan;
  }

  async function findMatchingPlan(
    page: EnvironmentArtworkPage,
    paths: EnvironmentRuntimePaths
  ): Promise<EnvironmentPlan | null> {
    const existing =
      await jobRepository.readEnvironment(
        paths.environmentPath
      );
    const plan = toEnvironmentPlan(existing);
    return (
      plan?.version ===
        ENVIRONMENT_PLAN_SCHEMA_VERSION &&
      plan.promptVersion ===
        ENVIRONMENT_PLAN_PROMPT_VERSION &&
      plan.imageUrl === page.imageUrl &&
      hasExpectedTargets(page, plan)
    )
      ? plan
      : null;
  }

  function queuePlan(
    task: EnvironmentPlanTask
  ): void {
    const {
      page,
      paths
    } = task;
    if (
      !page.imageUrl ||
      pendingPlans.has(
        paths.environmentPath
      ) ||
      isPathBeingFlushed(
        paths.environmentPath
      )
    ) {
      return;
    }
    pendingPlans.set(
      paths.environmentPath,
      task
    );
    scheduleProcessing();
  }

  function cancelForCountry(
    countryCacheRoot: string
  ): Promise<void>[] {
    const activeRuns: Promise<void>[] = [];
    for (const [environmentPath] of pendingPlans) {
      if (
        isPathInside(
          countryCacheRoot,
          path.normalize(environmentPath)
        )
      ) {
        pendingPlans.delete(environmentPath);
      }
    }
    if (
      activeTask &&
      isPathInside(
        countryCacheRoot,
        path.normalize(
          activeTask.environmentPath
        )
      )
    ) {
      activeTask.controller.abort(
        new Error(
          "Environment analysis cancelled because its country runtime cache was flushed."
        )
      );
      activeRuns.push(activeTask.done);
    }
    return activeRuns;
  }

  function scheduleProcessing(
    delayMs = 250
  ): void {
    if (processorActive) return;
    setTimeout(() => {
      processNext().catch((error) => {
        logger.error(
          "Environment plan processing failed:",
          error
        );
      });
    }, delayMs);
  }

  async function processNext(): Promise<void> {
    if (
      processorActive ||
      pendingPlans.size === 0
    ) {
      return;
    }
    const nextTask =
      pendingPlans.entries().next().value;
    if (!nextTask) return;
    const [environmentPath, task] = nextTask;
    pendingPlans.delete(environmentPath);
    processorActive = true;
    const controller = new AbortController();
    let resolveDone:
      | (() => void)
      | undefined;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    activeTask = {
      environmentPath,
      controller,
      done
    };
    try {
      await updateReadyJob(
        task.jobPath,
        task.page.imageUrl,
        {
          environmentUrl:
            task.paths.environmentUrl,
          environmentStatus: "processing",
          environmentProcessingStartedAt:
            new Date().toISOString()
        }
      );
      const plan = await ensurePlan(
        task.page,
        task.paths,
        {
          signal: controller.signal,
          jobPath: task.jobPath
        }
      );
      await updateReadyJob(
        task.jobPath,
        task.page.imageUrl,
        {
          environmentUrl:
            task.paths.environmentUrl,
          environmentStatus:
            typeof plan?.status === "string"
              ? plan.status
              : "fallback",
          environmentCompletedAt:
            new Date().toISOString()
        }
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        await updateReadyJob(
          task.jobPath,
          task.page.imageUrl,
          {
            environmentUrl:
              task.paths.environmentUrl,
            environmentStatus: "failed",
            environmentError:
              errorMessage(error),
            environmentFailedAt:
              new Date().toISOString()
          }
        );
      }
    } finally {
      if (activeTask?.done === done) {
        activeTask = null;
      }
      resolveDone?.();
      processorActive = false;
      if (pendingPlans.size > 0) {
        scheduleProcessing();
      }
    }
  }

  async function updateReadyJob(
    jobPath: string,
    imageUrl: unknown,
    patch: ArtworkJobRecord
  ): Promise<boolean> {
    const currentJob =
      await jobRepository.readJob(jobPath);
    if (
      currentJob?.status !== "ready" ||
      currentJob.imageUrl !== imageUrl
    ) {
      return false;
    }
    await jobRepository.writeJob(
      jobPath,
      {
        ...currentJob,
        ...patch
      }
    );
    return true;
  }

  return {
    ensurePlan,
    findMatchingPlan,
    queuePlan,
    cancelForCountry
  };
}

export type EnvironmentPlanQueue = ReturnType<
  typeof createEnvironmentPlanQueue
>;

function throwIfAborted(
  signal: AbortSignal | null
): void {
  if (signal?.aborted) {
    throw (
      signal.reason ??
      new Error("Operation aborted.")
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function toEnvironmentPlan(
  value: ArtworkJobRecord | null
): EnvironmentPlan | null {
  if (
    value?.status !== undefined &&
    value.status !== null &&
    typeof value.status !== "string"
  ) {
    return null;
  }
  return value as EnvironmentPlan | null;
}
