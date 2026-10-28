import styles from "./AppVersion.module.css";

export function AppVersion({ className = "" }: { className?: string }) {
  return (
    <span className={`${styles.version} ${className}`} aria-label={`App version ${__APP_VERSION__}`}>
      v{__APP_VERSION__}
    </span>
  );
}
