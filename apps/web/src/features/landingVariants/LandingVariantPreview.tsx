import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router";

import { LANDING_VARIANTS, resolveLandingVariant, type LandingVariantProps } from "./landingVariantTypes";
import styles from "./LandingVariantPreview.module.css";

const PlayfulLanding = lazy(() => import("./playful/PlayfulLanding").then((module) => ({ default: module.PlayfulLanding })));
const AtlasLanding = lazy(() => import("./atlas/AtlasLanding").then((module) => ({ default: module.AtlasLanding })));
const CinematicLanding = lazy(() => import("./cinematic/CinematicLanding").then((module) => ({ default: module.CinematicLanding })));

const OriginalLanding = lazy(() => import("./original/OriginalLanding").then((module) => ({ default: module.OriginalLanding })));

const HorizonLanding = lazy(() => import("./horizon/HorizonLanding").then((module) => ({ default: module.HorizonLanding })));

const HorizonLandingTwo = lazy(() => import("./horizon/HorizonLanding").then((module) => ({ default: module.HorizonLandingTwo })));

export function LandingVariantPreview(props: LandingVariantProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = resolveLandingVariant(searchParams.get("landing"));
  const Landing = active === "horizon2" ? HorizonLandingTwo : active === "horizon" ? HorizonLanding : active === "original" ? OriginalLanding : active === "atlas" ? AtlasLanding : active === "cinematic" ? CinematicLanding : PlayfulLanding;

  if (!searchParams.has("landing")) {
    return <Suspense fallback={<div className={styles.loading} role="status">Opening RoamAtlas…</div>}><HorizonLandingTwo {...props} /></Suspense>;
  }

  return (
    <div className={styles.preview}>
      <nav className={styles.switcher} aria-label="Compare landing designs">
        <span className={styles.label}>DESIGN EXPLORATION</span>
        <div className={styles.options}>
          {LANDING_VARIANTS.map((variant) => (
            <button
              type="button"
              key={variant.id}
              aria-pressed={active === variant.id}
              onClick={() => setSearchParams((current) => {
                current.set("landing", variant.id);
                return current;
              }, { replace: true })}
            >
              <span className={styles.number}>{variant.number}</span>{variant.name}
            </button>
          ))}
        </div>
        <span className={styles.note}>COMPARE ALL SIX</span>
      </nav>
      <div className={styles.canvas}>
        <Suspense fallback={<div className={styles.loading} role="status">Opening this direction…</div>}>
          <Landing key={active} {...props} />
        </Suspense>
      </div>
    </div>
  );
}
