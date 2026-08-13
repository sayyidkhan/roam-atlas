import {
  useEffect,
  useState,
  type RefObject
} from "react";

type ExplorerFullscreenButtonProps = {
  targetRef: RefObject<HTMLElement | null>;
};

export function ExplorerFullscreenButton({
  targetRef
}: ExplorerFullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSupported =
    typeof document !== "undefined" &&
    document.fullscreenEnabled;

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(
        document.fullscreenElement === targetRef.current
      );
    }

    document.addEventListener(
      "fullscreenchange",
      syncFullscreenState
    );
    return () => {
      document.removeEventListener(
        "fullscreenchange",
        syncFullscreenState
      );
    };
  }, [targetRef]);

  async function toggleFullscreen() {
    const target = targetRef.current;
    if (!target || !isSupported) return;

    if (document.fullscreenElement === target) {
      await document.exitFullscreen();
    } else {
      await target.requestFullscreen();
    }

    setIsFullscreen(document.fullscreenElement === target);
  }

  const label = isFullscreen
    ? "Exit full screen"
    : "Enter full screen";

  return (
    <button
      type="button"
      className="ghost-button explorer-header-action explorer-fullscreen-action"
      aria-label={label}
      aria-pressed={isFullscreen}
      data-tooltip={isFullscreen ? "Exit full screen" : "Full screen"}
      disabled={!isSupported}
      title={isSupported ? label : "Full screen is not supported"}
      onClick={() => void toggleFullscreen()}
    >
      <FullscreenIcon isFullscreen={isFullscreen} />
      <span className="explorer-header-action-label">
        {isFullscreen ? "Exit full screen" : "Full screen"}
      </span>
    </button>
  );
}

function FullscreenIcon({
  isFullscreen
}: {
  isFullscreen: boolean;
}) {
  return (
    <svg
      className="explorer-header-action-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      {isFullscreen ? (
        <>
          <path d="M8 4v4H4" />
          <path d="M12 4v4h4" />
          <path d="M8 16v-4H4" />
          <path d="M12 16v-4h4" />
        </>
      ) : (
        <>
          <path d="M8 4H4v4" />
          <path d="M12 4h4v4" />
          <path d="M8 16H4v-4" />
          <path d="M12 16h4v-4" />
        </>
      )}
    </svg>
  );
}
