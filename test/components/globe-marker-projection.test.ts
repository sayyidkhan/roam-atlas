import { describe, expect, it } from "vitest";

import {
  focusAngles,
  nearestVisibleMarker,
  projectGlobeMarker
} from "../../apps/web/src/features/countryCatalog/globeMarkerProjection";

describe("projectGlobeMarker", () => {
  it("places the focused country near the middle of the globe and hides the far side", () => {
    const [phi, theta] = focusAngles(1.35, 103.82);
    const singapore = projectGlobeMarker({
      height: 400,
      latitude: 1.35,
      longitude: 103.82,
      phi,
      theta,
      width: 400
    });
    const farSide = projectGlobeMarker({
      height: 400,
      latitude: 1.35,
      longitude: 103.82 + 180,
      phi,
      theta,
      width: 400
    });

    expect(singapore.visible).toBe(true);
    expect(singapore.x).toBeGreaterThan(160);
    expect(singapore.x).toBeLessThan(240);
    expect(singapore.y).toBeGreaterThan(160);
    expect(singapore.y).toBeLessThan(240);
    expect(farSide.visible).toBe(false);
  });

  it("chooses the closest visible pin inside the click radius", () => {
    const slug = nearestVisibleMarker(
      [
        { slug: "japan", visible: true, x: 20, y: 20 },
        { slug: "singapore", visible: true, x: 40, y: 40 },
        { slug: "brazil", visible: false, x: 41, y: 41 }
      ],
      { x: 36, y: 36 },
      28
    );

    expect(slug).toBe("singapore");
  });
});
