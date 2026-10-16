import { useEffect, useRef, useState } from "react";
import { countryPhotoUrl } from "../cinematic/cinematicCountryPresentation";
import styles from "./CountryBackdrop.module.css";

type Layer = { id: number; src: string };

export function CountryBackdrop({ slug }: { slug: string }) {
  const src = countryPhotoUrl(slug);
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>([{ id: 0, src }]);

  useEffect(() => {
    let cancelled = false;
    const photo = new Image();
    photo.onload = async () => {
      // Keep the existing photograph visible until its replacement is decoded.
      try { await photo.decode(); } catch { /* Loaded images can still render if decode is unsupported. */ }
      if (cancelled) return;
      const id = nextId.current++;
      setLayers((current) => current.at(-1)?.src === src ? current : [...current, { id, src }]);
    };
    photo.src = src;
    return () => { cancelled = true; photo.onload = null; };
  }, [src]);

  useEffect(() => {
    if (layers.length < 2) return;
    // Retain the layers through rapid selections; remove them only after the fade settles.
    const timer = setTimeout(() => setLayers((current) => current.slice(-1)), 900);
    return () => clearTimeout(timer);
  }, [layers]);

  return <div className={styles.backdrop} aria-hidden="true">
    {layers.map((layer) => <img key={layer.id} src={layer.src} alt="" className={layer.id === 0 ? styles.initial : styles.layer} fetchPriority="high" />)}
  </div>;
}
