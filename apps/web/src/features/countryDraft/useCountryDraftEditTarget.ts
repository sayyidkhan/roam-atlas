import {
  useEffect,
  useState
} from "react";

import { getCountryDraftEditContext } from "./countryDraftChatPolicy";
import type { CountryDraft } from "./countryDraftTypes";

/**
 * Owns the selected GenAI edit target inside the React draft surface.
 *
 * A target is exposed only while it still resolves to the current draft.
 * Removing or replacing a candidate therefore closes its dialog without
 * coupling domain mutations back to presentation state.
 */
export function useCountryDraftEditTarget(
  draft: CountryDraft | null
) {
  const [requestedTarget, setRequestedTarget] =
    useState<string | null>(null);
  const targetIsValid = Boolean(
    draft &&
      requestedTarget &&
      getCountryDraftEditContext(draft, requestedTarget)
  );
  const target = targetIsValid ? requestedTarget : null;

  useEffect(() => {
    if (requestedTarget && !targetIsValid) {
      setRequestedTarget(null);
    }
  }, [requestedTarget, targetIsValid]);

  function toggle(nextTarget: string): void {
    if (!draft || !getCountryDraftEditContext(draft, nextTarget)) {
      return;
    }
    setRequestedTarget((currentTarget) =>
      currentTarget === nextTarget ? null : nextTarget
    );
  }

  function close(): void {
    setRequestedTarget(null);
  }

  return {
    close,
    target,
    toggle
  };
}
