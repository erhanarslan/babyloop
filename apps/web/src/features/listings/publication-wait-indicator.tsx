import styles from "./publication-wait-indicator.module.css";

type PublicationWaitIndicatorProps = {
  label?: string;
};

export function PublicationWaitIndicator({
  label = "Onay bekliyor",
}: PublicationWaitIndicatorProps) {
  return (
    <span className={styles.indicator} role="img" aria-label={label} title={label}>
      <span className={styles.pulse} aria-hidden="true" />
      <svg className={styles.hourglass} aria-hidden="true" viewBox="0 0 20 26">
        <path className={styles.frame} d="M4 2h12M4 24h12M5 3c0 5 1.8 7.2 5 10-3.2 2.8-5 5-5 10M15 3c0 5-1.8 7.2-5 10 3.2 2.8 5 5 5 10" />
        <path className={styles.topSand} d="M7 6h6c-.4 2.2-1.4 3.6-3 5-1.6-1.4-2.6-2.8-3-5Z" />
        <rect className={styles.stream} x="9.45" y="11" width="1.1" height="5" rx=".55" />
        <path className={styles.bottomSand} d="M7 21c.5-2.2 1.5-3.6 3-5 1.5 1.4 2.5 2.8 3 5H7Z" />
      </svg>
    </span>
  );
}
