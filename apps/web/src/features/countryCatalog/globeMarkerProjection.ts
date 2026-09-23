const SPHERE_RADIUS = 0.8;

export type GlobePlace = {
  location: [number, number];
  slug: string;
};

export const ATLAS_GLOBE_PLACES: GlobePlace[] = [
  { slug: "singapore", location: [1.35, 103.82] },
  { slug: "malaysia", location: [4.21, 101.98] },
  { slug: "thailand", location: [13.75, 100.5] },
  { slug: "vietnam", location: [16.05, 108.2] },
  { slug: "indonesia", location: [-6.2, 106.85] },
  { slug: "japan", location: [35.68, 139.69] },
  { slug: "south-korea", location: [37.57, 126.98] }
];

export type MarkerProjection = {
  visible: boolean;
  x: number;
  y: number;
};

export function focusAngles(latitude: number, longitude: number): [number, number] {
  return [
    Math.PI - ((longitude * Math.PI) / 180 - Math.PI / 2),
    (latitude * Math.PI) / 180
  ];
}

export function projectGlobeMarker(input: {
  height: number;
  latitude: number;
  longitude: number;
  phi: number;
  scale?: number;
  theta: number;
  width: number;
}): MarkerProjection {
  const latitude = (input.latitude * Math.PI) / 180;
  const longitude = (input.longitude * Math.PI) / 180;
  const cosLatitude = Math.cos(latitude);
  const point = [
    -cosLatitude * Math.cos(longitude),
    Math.sin(latitude),
    cosLatitude * Math.sin(longitude)
  ];
  const cosPhi = Math.cos(input.phi);
  const sinPhi = Math.sin(input.phi);
  const cosTheta = Math.cos(-input.theta);
  const sinTheta = Math.sin(-input.theta);
  const [px, py, pz] = point;
  const viewX = cosPhi * px + sinPhi * pz;
  const viewY = sinPhi * sinTheta * px + cosTheta * py - cosPhi * sinTheta * pz;
  const viewZ = -sinPhi * cosTheta * px + sinTheta * py + cosPhi * cosTheta * pz;
  const scale = input.scale ?? 1;
  const ndcX = -viewX * SPHERE_RADIUS * scale * (input.height / input.width);
  const ndcY = viewY * SPHERE_RADIUS * scale;

  return {
    visible: viewZ < 0,
    x: ((ndcX + 1) / 2) * input.width,
    y: ((1 - ndcY) / 2) * input.height
  };
}

export function nearestVisibleMarker(
  markers: Array<MarkerProjection & { slug: string }>,
  pointer: { x: number; y: number },
  radius: number
): string | null {
  let nearest: { distance: number; slug: string } | null = null;

  for (const marker of markers) {
    if (!marker.visible) continue;
    const distance = Math.hypot(marker.x - pointer.x, marker.y - pointer.y);
    if (distance > radius) continue;
    if (!nearest || distance < nearest.distance) {
      nearest = { distance, slug: marker.slug };
    }
  }

  return nearest?.slug ?? null;
}
