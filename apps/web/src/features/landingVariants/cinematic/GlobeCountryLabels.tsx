import type { CountryCatalogCountry } from "../../countryCatalog/CountryCardMedia";
import { countryCoordinates } from "../../countryCatalog/countryGeography";
import { projectGlobeMarker } from "../../countryCatalog/globeMarkerProjection";
import type { GlobeAngles } from "./globeNavigation";
import styles from "./DestinationGlobe.module.css";

type Props = {
  countries: CountryCatalogCountry[];
  view: GlobeAngles;
  selectedSlug?: string;
  moving: boolean;
  onSelect: (country: CountryCatalogCountry) => void;
};

export function GlobeCountryLabels({ countries, view, selectedSlug, moving, onSelect }: Props) {
  const points = countries.map((country) => {
    const [latitude, longitude] = countryCoordinates[country.code];
    return { country, ...projectGlobeMarker({ latitude, longitude, width: 100, height: 100, ...view }) };
  }).filter((point) => point.visible).sort((a, b) => a.x - b.x);
  // Three fixed slots on each side keep targets apart, even in dense regions.
  const split = Math.ceil(points.length / 2);
  const labels = [points.slice(0, split), points.slice(split)].flatMap((side, index) =>
    side.sort((a, b) => a.y - b.y).map((point, row) => ({ ...point, side: index, top: side.length === 2 ? 32 + row * 36 : 22 + row * 28 }))
  );
  return <div className={styles["map-labels"]} aria-label="Countries on the globe" data-moving={moving}>
    <svg className={styles.leaders} viewBox="0 0 100 100" aria-hidden="true">
      {labels.map((label) => <g key={label.country.slug} data-selected={label.country.slug === selectedSlug}>
        <path d={`M ${label.side ? 74 : 26} ${label.top} L ${label.x} ${label.y}`} />
        <circle cx={label.x} cy={label.y} r="1.1" />
      </g>)}
    </svg>
    {labels.map((label) => <button type="button" key={label.country.slug} className={styles["map-label"]}
      style={{ top: `${label.top}%`, [label.side ? "right" : "left"]: 0 }}
      aria-label={`Globe preview ${label.country.name}`} aria-pressed={label.country.slug === selectedSlug}
      aria-disabled={moving} tabIndex={moving ? -1 : 0} onClick={() => { if (!moving) onSelect(label.country); }}>
        <img className={styles["label-flag"]} src={`https://flagcdn.com/w40/${label.country.code.toLowerCase()}.png`} alt="" width="22" height="16" decoding="async" onError={(event) => { event.currentTarget.hidden = true; }} />
        <span>{label.country.name}</span>
      </button>)}
  </div>;
}
