import type { RuntimePage } from "../../app/browserRuntime";
import type {
  createExplorerPageTransitionController
} from "./explorerPageTransitionController";

type ExplorerPageTransitionController = ReturnType<
  typeof createExplorerPageTransitionController
>;

export function createExplorerPageTransitionBridge() {
  let controller: ExplorerPageTransitionController | null =
    null;

  function requireController(): ExplorerPageTransitionController {
    if (!controller) {
      throw new Error(
        "Explorer page transitions have not been composed yet."
      );
    }
    return controller;
  }

  return {
    attach(
      nextController: ExplorerPageTransitionController
    ): void {
      controller = nextController;
    },
    clearPendingJob(): void {
      requireController().clearPendingJob();
    },
    enterReadyPage(page: RuntimePage): void {
      requireController().enterReadyPage(page);
    }
  };
}
