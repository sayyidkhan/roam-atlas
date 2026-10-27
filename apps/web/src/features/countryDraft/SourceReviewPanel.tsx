import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CountryDraft } from "./countryDraftTypes";
import styles from "./CountryDraftReview.module.css";

export function SourceReviewPanel({ countryName, draft }: {
  countryName: string;
  draft: CountryDraft;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const items = (draft.reviewChecklist ?? []).filter(Boolean);

  return (
    <div className={styles.reviewed}>
      <a
        ref={triggerRef}
        href={`#${id}`}
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={(event) => {
          event.preventDefault();
          dialogRef.current?.showModal();
          setIsOpen(true);
        }}
      >Where this info comes from</a>
      {createPortal(
        <dialog
          ref={dialogRef}
          id={id}
          className={styles.panel}
          aria-labelledby={`${id}-title`}
          onClose={() => {
            setIsOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <header className={styles["panel-header"]}>
            <div>
              <p className={styles.kicker}>{countryName}</p>
              <h2 id={`${id}-title`}>About the travel info</h2>
            </div>
            <form method="dialog">
              <button type="submit" className={styles.close} aria-label="Close travel information">×</button>
            </form>
          </header>
          <div className={styles.body}>
            <section>
              <h3>The places and descriptions</h3>
              <p>These come from travel information saved in RoamAtlas. They do not update live.</p>
            </section>
            <section>
              <h3>The pictures</h3>
              <p>AI draws the illustrations using that information. A picture can contain imagined details.</p>
            </section>
            <section>
              <h3>Before you visit</h3>
              <p>Opening hours, ticket prices and closures can change. Check the venue’s official website for current details.</p>
            </section>
            <p className={styles["fact-note"]}>“Confirmed” means backed by an official source or a RoamAtlas reference. It does not mean the details were checked recently.</p>
            {items.length > 0 ? <details className={styles.checklist}>
              <summary>Maintaining this atlas</summary>
              <ol>
                {items.map((item, index) => <li key={`${index}:${item}`}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </li>)}
              </ol>
            </details> : null}
          </div>
          <footer className={styles["panel-footer"]}>
            <form method="dialog"><button type="submit" className={styles.done}>Done</button></form>
          </footer>
        </dialog>, document.body
      )}
    </div>
  );
}
