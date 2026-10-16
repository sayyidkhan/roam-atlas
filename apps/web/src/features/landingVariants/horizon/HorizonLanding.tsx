import type { LandingVariantProps } from "../landingVariantTypes";
import { OriginalLanding } from "../original/OriginalLanding";

export function HorizonLanding(props: LandingVariantProps) {
  return <OriginalLanding {...props} presentation="horizon" />;
}

export function HorizonLandingTwo(props: LandingVariantProps) {
  return <OriginalLanding {...props} presentation="horizon2" />;
}
