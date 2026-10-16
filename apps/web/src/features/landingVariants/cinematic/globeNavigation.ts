import type { Continent } from "../../countryCatalog/countryContinents";
import type { CountryCatalogCountry } from "../../countryCatalog/CountryCardMedia";
import { countryCoordinates } from "../../countryCatalog/countryGeography";
import { projectGlobeMarker } from "../../countryCatalog/globeMarkerProjection";

export type GlobeAngles = { phi: number; theta: number };

export const globeRegions = [
  { continent: "Europe", name: "Europe", location: [50, 15] },
  { continent: "Asia", name: "Asia", location: [30, 100] },
  { continent: "Africa", name: "Africa", location: [0, 20] },
  { continent: "North America", name: "N. America", location: [35, -100] },
  { continent: "South America", name: "S. America", location: [-20, -60] },
  { continent: "Oceania", name: "Oceania", location: [-20, 150] }
] satisfies Array<{ continent: Continent; name: string; location: [number, number] }>;

export function shortestGlobeTurn(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// Rank by distance to the camera centre, not by alphabet or pack availability.
export function countriesInView(countries: CountryCatalogCountry[], angles: GlobeAngles) {
  return countries.flatMap((country) => {
    const location = countryCoordinates[country.code];
    if (!location) return [];
    const point = projectGlobeMarker({ latitude: location[0], longitude: location[1], width: 1, height: 1, ...angles });
    return point.visible ? [{ country, distance: Math.hypot(point.x - 0.5, point.y - 0.5) }] : [];
  }).sort((a, b) => a.distance - b.distance).slice(0, 6).map(({ country }) => country);
}
