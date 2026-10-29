import { useId } from "react";
import { ImageQualityDropdown } from "./ImageQualityDropdown";
import { DraftTooltip } from "../../countryDraft/CountryDraftMetadata";
import { useDraftTooltip } from "../../countryDraft/useDraftTooltip";
import styles from "./ImageQualitySetting.module.css";
import type {
  ImageQualityOption
} from "../countrySetupStore";
import type {
  CountryArtworkQualityLockState
} from "../../artwork/countryArtworkQualityLockStore";

export function ImageQualitySetting({
  selectedValue,
  options,
  lockState,
  onChange,
  inline = false
}: {
  selectedValue: string;
  options: readonly ImageQualityOption[];
  lockState: CountryArtworkQualityLockState;
  onChange: (value: string) => void;
  inline?: boolean;
}) {
  const controlId = useId();
  const statusId = `${controlId}-status`;
  const help = useDraftTooltip();
  const isLocked =
    lockState.status === "ready" && lockState.lock.locked;
  const isLoading =
    lockState.status === "idle" || lockState.status === "loading";
  const isUnavailable = lockState.status === "failed";
  const activeValue =
    lockState.status === "ready" && lockState.lock.imageQuality
      ? lockState.lock.imageQuality
      : selectedValue;

  return (
    <div className={`${styles.setting}${inline ? ` ${styles.inline}` : ""}`}>
      <div className={styles.field} data-locked={inline && isLocked}>
        <label htmlFor={controlId}>{inline ? "Illustration" : "Illustration detail"}</label>
        <ImageQualityDropdown
          key={String(isLocked || isLoading || isUnavailable)}
          id={controlId}
          value={activeValue}
          options={options}
          describedBy={isLocked || isLoading || isUnavailable ? statusId : undefined}
          disabled={isLocked || isLoading || isUnavailable}
          locked={inline && isLocked}
          onChange={onChange}
        />
        {inline && isLocked ? (
          <button
            {...help.triggerProps}
            type="button"
            className={`${styles["lock-help"]} ${help.className}`}
            aria-label="Why illustration detail is locked"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
              <rect x="3.5" y="7" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <DraftTooltip id={help.id} title="Illustration detail is locked" copy="This map already has generated visuals. Reset visuals to choose a different detail level. Your places and descriptions stay." />
          </button>
        ) : null}
      </div>
      {isLocked ? (
        <p id={statusId} className={inline ? styles["hidden-status"] : styles.status} role="status">
          Illustration detail is locked. Reset visuals to change it.
        </p>
      ) : isLoading ? (
        <p id={statusId} className={styles.status} role="status">Checking existing visuals</p>
      ) : isUnavailable ? (
        <p id={statusId} className={`${styles.status} ${styles.unavailable}`} role="status">
          Couldn’t verify visuals. Refresh to retry.
        </p>
      ) : null}
    </div>
  );
}
