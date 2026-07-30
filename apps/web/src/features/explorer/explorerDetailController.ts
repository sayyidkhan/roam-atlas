import type { RuntimePack } from "../../app/browserRuntime";
import {
  explorerDetailStore,
  type ExplorerDetailMode,
  type ExplorerDetailNode,
  type ExplorerDetailOverride
} from "./explorerDetailStore";

type ExplorerDetailState = {
  activePack: RuntimePack | null;
  currentPage: { nodeId?: string | null } | null;
  detailOverride: unknown;
  detailPanelMode: string;
  selectedNodeId: string | null;
};

type ExplorerDetailControllerDependencies = {
  endNavigationFeedback: () => void;
  state: ExplorerDetailState;
};

export function createExplorerDetailController({
  endNavigationFeedback,
  state
}: ExplorerDetailControllerDependencies) {
  function getDetailNode(): ExplorerDetailNode | null {
    const nodeId = state.currentPage?.nodeId;
    if (
      !nodeId ||
      nodeId === state.activePack?.rootNodeId
    ) {
      return null;
    }
    return (
      (state.activePack?.nodes[nodeId] as
        | ExplorerDetailNode
        | undefined) ?? null
    );
  }

  function renderNodeDetail(): void {
    explorerDetailStore.getState().setSnapshot({
      commands: {
        close,
        collapse,
        expand
      },
      detailOverride: toDetailOverride(state.detailOverride),
      mode: toDetailMode(state.detailPanelMode),
      node: getDetailNode()
    });
  }

  function close(): void {
    state.detailOverride = null;
    state.detailPanelMode = "hidden";
    renderNodeDetail();
  }

  function collapse(): void {
    state.detailPanelMode = "compact";
    renderNodeDetail();
  }

  function expand(): void {
    state.detailPanelMode = "expanded";
    renderNodeDetail();
  }

  function renderDetour(detour: ExplorerDetailOverride): void {
    state.selectedNodeId = null;
    state.detailOverride = detour;
    state.detailPanelMode = "expanded";
    endNavigationFeedback();
    renderNodeDetail();
  }

  return {
    renderDetour,
    renderNodeDetail
  };
}

function toDetailMode(value: string): ExplorerDetailMode {
  return value === "compact" || value === "expanded"
    ? value
    : "hidden";
}

function toDetailOverride(
  value: unknown
): ExplorerDetailOverride | null {
  if (!value || typeof value !== "object") return null;
  return value as ExplorerDetailOverride;
}
