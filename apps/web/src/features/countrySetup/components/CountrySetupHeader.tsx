import type { ReactNode } from "react";
import type { CountryArtworkQualityLockState } from "../../artwork/countryArtworkQualityLockStore";
import type { CountrySetupState } from "../countrySetupStore";
import { CountrySetupHero } from "./CountrySetupHero";
import { ImageQualitySetting } from "./ImageQualitySetting";
import styles from "../CountrySetupSurface.module.css";

export function CountrySetupHeader({
  snapshot,
  lockState,
  review
}: {
  snapshot: CountrySetupState;
  lockState: CountryArtworkQualityLockState;
  review: ReactNode;
}) {
  return (
    <div className={`country-draft-header ${styles["setup-header"]}`}>
      <CountrySetupHero snapshot={snapshot}>{review}</CountrySetupHero>
      <div className={styles["header-controls"]}>
        <ImageQualitySetting
          inline
          selectedValue={snapshot.imageQuality}
          options={snapshot.imageQualityOptions}
          lockState={lockState}
          onChange={snapshot.commands.setImageQuality}
        />
      </div>
    </div>
  );
}
