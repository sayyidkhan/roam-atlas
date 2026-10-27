import { useId } from "react";
import { ImageQualityDropdown } from "./ImageQualityDropdown";
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
      <div className={styles.field}>
        <label htmlFor={controlId}>{inline ? "Illustration" : "Illustration detail"}</label>
        <ImageQualityDropdown
          key={String(isLocked || isLoading || isUnavailable)}
          id={controlId}
          value={activeValue}
          options={options}
          describedBy={isLocked || isLoading || isUnavailable ? statusId : undefined}
          disabled={isLocked || isLoading || isUnavailable}
          onChange={onChange}
        />
      </div>
      {isLocked ? (
        <p id={statusId} className={styles.status} role="status">
          Locked · reset visuals to change
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
