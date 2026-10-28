import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from "react";

import styles from "./DraftTooltip.module.css";

/** Keep help beside its control as the page scrolls or the layout changes. */
export function useDraftTooltip() {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [placement, setPlacement] = useState({ side: "bottom", shift: 0, dismissed: false });

  function position(event: SyntheticEvent<HTMLElement>) {
    anchor.current = event.currentTarget;
    const next = measureTooltip(event.currentTarget);
    if (next) setPlacement({ ...next, dismissed: false });
    setActive(true);
  }

  function leave(event: SyntheticEvent<HTMLElement>) {
    if (!event.currentTarget.contains(document.activeElement)) setActive(false);
  }

  function blur(event: SyntheticEvent<HTMLElement>) {
    if (!event.currentTarget.matches(":hover")) setActive(false);
  }

  useEffect(() => {
    const trigger = anchor.current;
    if (!active || !trigger) return;

    const update = () => {
      const next = measureTooltip(trigger);
      if (!next) return;
      setPlacement((current) => current.side === next.side && current.shift === next.shift
        ? current : { ...current, ...next });
    };

    // The country shell scrolls independently of the window. Capture also
    // handles nested scroll surfaces without binding to one page's markup.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(trigger);
    const tooltip = trigger.querySelector(".draft-button-tooltip");
    if (tooltip) observer?.observe(tooltip);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [active]);

  function dismiss(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") setPlacement((current) => ({ ...current, dismissed: true }));
  }

  return {
    id,
    className: styles.trigger,
    triggerProps: {
      "aria-describedby": id,
      "data-tooltip-side": placement.side,
      "data-tooltip-dismissed": placement.dismissed,
      onPointerEnter: position,
      onPointerLeave: leave,
      onFocus: position,
      onBlur: blur,
      onKeyDown: dismiss,
      style: { "--draft-tooltip-shift": `${placement.shift}px` } as CSSProperties
    }
  };
}

function measureTooltip(trigger: HTMLElement) {
  const tooltip = trigger.querySelector<HTMLElement>(".draft-button-tooltip");
  if (!tooltip) return null;
  const bounds = trigger.getBoundingClientRect();
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  const header = trigger.closest(".country-draft")?.querySelector(".country-draft-header");
  const topEdge = Math.max(8, header?.getBoundingClientRect().bottom ?? 0);
  const below = window.innerHeight - bounds.bottom - 18;
  const above = bounds.top - topEdge - 10;
  const left = Math.max(8, Math.min(bounds.left, document.documentElement.clientWidth - width - 8));
  return {
    side: below >= height || below >= above ? "bottom" : "top",
    shift: left - bounds.left
  };
}
