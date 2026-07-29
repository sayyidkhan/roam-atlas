type NavigationRequestState = {
  activeNavigationRequestId: number | string | null;
  isResolvingClick: boolean;
};

type NavigationRequestControllerDependencies = {
  endNavigationFeedback: () => void;
  state: NavigationRequestState;
};

export function createExplorerNavigationRequestController(
  dependencies: NavigationRequestControllerDependencies
) {
  const { endNavigationFeedback, state } = dependencies;
  let navigationRequestSequence = 0;
  let navigationAbortController: AbortController | null = null;

  function beginNavigationRequest(): {
    id: number;
    signal: AbortSignal;
  } {
    navigationAbortController?.abort();
    navigationAbortController = new AbortController();
    const id = ++navigationRequestSequence;
    state.activeNavigationRequestId = id;
    state.isResolvingClick = true;
    return { id, signal: navigationAbortController.signal };
  }

  function isNavigationRequestCurrent(id: number): boolean {
    return state.activeNavigationRequestId === id;
  }

  function finishNavigationRequest(id: number): void {
    if (!isNavigationRequestCurrent(id)) return;
    navigationAbortController = null;
    resetNavigationState();
  }

  function cancelPendingNavigation(): void {
    navigationAbortController?.abort();
    navigationAbortController = null;
    resetNavigationState();
  }

  function resetNavigationState(): void {
    state.activeNavigationRequestId = null;
    state.isResolvingClick = false;
    endNavigationFeedback();
  }

  return {
    beginNavigationRequest,
    cancelPendingNavigation,
    finishNavigationRequest,
    isNavigationRequestCurrent
  };
}
