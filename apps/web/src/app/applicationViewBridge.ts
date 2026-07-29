import type {
  createApplicationViewController
} from "./applicationViewController";

type ApplicationViewController = ReturnType<
  typeof createApplicationViewController
>;

export function createApplicationViewBridge() {
  let controller: ApplicationViewController | null = null;

  return {
    attach(nextController: ApplicationViewController): void {
      controller = nextController;
    },
    render(): void {
      if (!controller) {
        throw new Error(
          "Application view has not been composed yet."
        );
      }
      controller.render();
    }
  };
}
