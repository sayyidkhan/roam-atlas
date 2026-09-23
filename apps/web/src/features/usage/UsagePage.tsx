import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import type {
  UsageFeature,
  UsageRecord
} from "@roamatlas/contracts/usageContract.js";
import { fetchUsage } from "./usageClient";
import styles from "./UsagePage.module.css";

const FEATURE_LABELS: Record<UsageFeature, string> = {
  country_draft: "Country curation",
  environment_plan: "Environment plan",
  image_generation: "Atlas illustration",
  place_image_suggestion: "Image search prompt",
  visual_click_resolution: "Visual click"
};

export function UsagePage() {
  const usageQuery = useQuery({
    queryKey: ["provider-usage"],
    queryFn: fetchUsage,
    refetchInterval: 15_000
  });
  const usage = usageQuery.data;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>RoamAtlas operations</p>
          <h1>AI usage ledger</h1>
          <p className={styles.intro}>
            Provider activity recorded by this API runtime. Prompts,
            generated content, and API keys are never stored here.
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => void usageQuery.refetch()}
            disabled={usageQuery.isFetching}
          >
            {usageQuery.isFetching ? "Refreshing…" : "Refresh"}
          </button>
          <Link to="/">Back to atlas</Link>
        </div>
      </header>

      {usageQuery.isError ? (
        <section className={styles.notice} role="alert">
          Usage data could not be loaded. Check that the API is running.
        </section>
      ) : (
        <>
          <section
            className={styles.metrics}
            aria-label="Usage summary"
          >
            <Metric
              label="Estimated spend"
              value={formatUsd(usage?.summary.estimatedCostUsd ?? 0)}
              detail="Current runtime ledger"
            />
            <Metric
              label="Requests"
              value={formatInteger(usage?.summary.requests ?? 0)}
              detail="Completed provider calls"
            />
            <Metric
              label="Input tokens"
              value={formatCompact(
                (usage?.summary.inputTokens ?? 0) +
                  (usage?.summary.imageInputTokens ?? 0)
              )}
              detail={`${formatCompact(
                usage?.summary.cachedInputTokens ?? 0
              )} cached`}
            />
            <Metric
              label="Output tokens"
              value={formatCompact(
                (usage?.summary.outputTokens ?? 0) +
                  (usage?.summary.imageOutputTokens ?? 0)
              )}
              detail="Text and image output"
            />
          </section>

          <section className={styles.ledger}>
            <div className={styles["ledger-heading"]}>
              <div>
                <p className={styles.eyebrow}>Recent activity</p>
                <h2>Provider requests</h2>
              </div>
              <p>
                {usage
                  ? `Updated ${formatTime(usage.generatedAt)}`
                  : "Loading usage…"}
              </p>
            </div>

            {usage?.records.length ? (
              <div className={styles.records}>
                {usage.records.map((record) => (
                  <UsageRow key={record.id} record={record} />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <span aria-hidden="true">◎</span>
                <h3>No provider calls recorded yet</h3>
                <p>
                  New image, planning, curation, and visual-click
                  requests will appear here automatically.
                </p>
              </div>
            )}
          </section>

          <p className={styles["pricing-note"]}>
            {usage?.pricingNote ??
              "Cost estimates appear after usage is loaded."}
          </p>
        </>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className={styles.metric}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function UsageRow({ record }: { record: UsageRecord }) {
  const inputTokens =
    record.inputTokens + record.imageInputTokens;
  const outputTokens =
    record.outputTokens + record.imageOutputTokens;
  return (
    <article className={styles.record}>
      <div className={styles["record-identity"]}>
        <span className={styles["feature-mark"]} aria-hidden="true" />
        <div>
          <h3>{FEATURE_LABELS[record.feature]}</h3>
          <p>
            {record.model}
            {record.serviceTier ? ` · ${record.serviceTier}` : ""}
          </p>
        </div>
      </div>
      <dl>
        <div>
          <dt>Tokens</dt>
          <dd>
            {formatCompact(inputTokens)} in /{" "}
            {formatCompact(outputTokens)} out
          </dd>
        </div>
        <div>
          <dt>Latency</dt>
          <dd>{formatDuration(record.durationMs)}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{formatUsd(record.estimatedCostUsd)}</dd>
        </div>
      </dl>
      <time dateTime={record.timestamp}>
        {formatDateTime(record.timestamp)}
      </time>
    </article>
  );
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function formatUsd(value: number): string {
  if (value > 0 && value < 0.01) return "<$0.01";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
}

function formatDuration(value: number): string {
  return value < 1_000
    ? `${value} ms`
    : `${(value / 1_000).toFixed(1)} s`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
