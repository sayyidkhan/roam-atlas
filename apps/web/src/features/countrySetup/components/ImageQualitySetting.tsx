import type {
  ImageQualityOption
} from "../countrySetupStore";

export function ImageQualitySetting({
  selectedValue,
  options,
  onChange
}: {
  selectedValue: string;
  options: readonly ImageQualityOption[];
  onChange: (value: string) => void;
}) {
  return (
    <section
      className="country-image-quality"
      aria-labelledby="image-quality-title"
    >
      <div className="country-image-quality-copy">
        <p className="eyebrow">Illustration quality</p>
        <h2 id="image-quality-title">Generated image detail</h2>
        <p>
          Choose the quality for new and regenerated map
          illustrations. High is recommended for the clearest atlas
          artwork.
        </p>
      </div>
      <div
        className="image-quality-options"
        role="radiogroup"
        aria-label="Generated image quality"
      >
        {options.map((option) => {
          const isActive = selectedValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`image-quality-option${isActive ? " is-active" : ""}`}
              data-country-action="set-image-quality"
              data-image-quality={option.value}
              role="radio"
              aria-checked={isActive}
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
    </section>
  );
}
