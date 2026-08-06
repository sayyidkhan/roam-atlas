import type { ExplorerDestinationInput } from "./explorerDestinationController";
import type { ExplorerSceneInput } from "./explorerSceneController";

type ExplorerPublishers = {
  chromeContent: (content: { title: string }) => void;
  chromeState: () => void;
  destinations: (input: ExplorerDestinationInput) => void;
  scene: (input: ExplorerSceneInput) => void;
};

export function createExplorerPublisherRegistry() {
  let publishers: ExplorerPublishers | null = null;

  function requirePublishers(): ExplorerPublishers {
    if (!publishers) {
      throw new Error(
        "Explorer publishers have not been composed yet."
      );
    }
    return publishers;
  }

  return {
    attach(nextPublishers: ExplorerPublishers): void {
      publishers = nextPublishers;
    },
    publishChromeContent(content: { title: string }): void {
      requirePublishers().chromeContent(content);
    },
    publishChromeState(): void {
      requirePublishers().chromeState();
    },
    publishDestinations(
      input: ExplorerDestinationInput
    ): void {
      requirePublishers().destinations(input);
    },
    publishScene(input: ExplorerSceneInput): void {
      requirePublishers().scene(input);
    }
  };
}
