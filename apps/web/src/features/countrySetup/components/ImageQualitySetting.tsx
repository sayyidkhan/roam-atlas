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
  onChange
}: {
  selectedValue: string;
  options: readonly ImageQualityOption[];
  lockState: CountryArtworkQualityLockState;
  onChange: (value: string) => void;
}) {
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
    <section
      className="country-image-quality"
      aria-labelledby="image-quality-title"
    >
      <div className="country-image-quality-copy">
        <p className="eyebrow">Illustration quality</p>
        <h2 id="image-quality-title">Generated image detail</h2>
        <p>
          {isLocked
            ? `This country is locked to ${activeValue} quality so every generated illustration stays visually consistent. Reset generated visuals to choose another quality.`
            : "Choose the quality before generating map illustrations. High is recommended for the clearest atlas artwork."}
        </p>
      </div>
      <div
        className={`image-quality-options${isLocked ? " is-locked" : ""}`}
        role="radiogroup"
        aria-label="Generated image quality"
      >
        {options.map((option) => {
          const isActive = activeValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`image-quality-option${isActive ? " is-active" : ""}`}
              data-country-action="set-image-quality"
              data-image-quality={option.value}
              role="radio"
              aria-checked={isActive}
              aria-disabled={isLocked || isLoading || isUnavailable}
              disabled={isLocked || isLoading || isUnavailable}
              onClick={() => onChange(option.value)}
            >
              <span className="image-quality-option-title">
                {option.label}
                {option.recommended ? (
                  <span className="image-quality-recommended">
                    Recommended
                  </span>
                ) : null}
              </span>
              <small>{option.description}</small>
            </button>
          );
        })}
      </div>
      {isLocked ? (
        <div className="image-quality-status" role="status">
          <strong>Locked to {activeValue} quality</strong>
          <span>
            Generated visuals use one quality. Reset generated visuals to
            change it.
          </span>
        </div>
      ) : isLoading ? (
        <div className="image-quality-status" role="status">
          <strong>Checking existing visuals</strong>
          <span>
            Quality selection unlocks once this check completes.
          </span>
        </div>
      ) : isUnavailable ? (
        <div className="image-quality-status is-unavailable" role="status">
          <strong>Couldn’t verify generated visuals</strong>
          <span>
            Refresh to check the quality setting again.
          </span>
        </div>
      ) : null}
    </section>
  );
}
