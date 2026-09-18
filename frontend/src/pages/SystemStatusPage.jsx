import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusTable } from "../features/system-status/StatusTable";
import { StatusBadge } from "../components/StatusBadge";
import { useHealth } from "../hooks/useHealth";
import { formatTimestamp, getIngestionSummary, getProviders, getSystemInfo } from "../lib/api";

export function SystemStatusPage() {
  const health = useHealth();
  const providers = useQuery({ queryKey: ["providers"], queryFn: getProviders, retry: 1 });
  const ingestion = useQuery({ queryKey: ["ingestion-summary"], queryFn: getIngestionSummary, retry: 1 });
  const info = useQuery({ queryKey: ["system-info"], queryFn: getSystemInfo, retry: 1 });

  return (
    <div>
      <PageHeader
        kicker="Operations"
        title="System Status"
        description="This demo runs entirely in the browser. There is no remote API, Postgres, or Qdrant server."
      />
      <div className="mb-5">
        {health.isPending ? <p className="text-[13px] text-ink-muted">Checking local store…</p> : null}
        {health.isError ? (
          <p className="text-[13px] text-bad">The browser store could not be read.</p>
        ) : null}
        {health.data?.ready ? (
          <p className="text-[13px] text-ok">Browser app and local knowledge index are available.</p>
        ) : null}
      </div>
      <StatusTable snapshot={health.data} />

      <h2 className="mb-3 mt-10 text-[13px] font-medium">Providers</h2>
      {providers.data ? (
        <dl className="max-w-3xl text-[13px]">
          <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-line py-2">
            <dt className="text-ink-muted">LLM</dt>
            <dd>
              <StatusBadge status={providers.data.llm.state} /> {providers.data.llm.name} —{" "}
              {providers.data.llm.message}
            </dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-line py-2">
            <dt className="text-ink-muted">Embeddings</dt>
            <dd>
              <StatusBadge status={providers.data.embeddings.state} /> {providers.data.embeddings.name} —{" "}
              {providers.data.embeddings.message}
            </dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-line py-2">
            <dt className="text-ink-muted">Index</dt>
            <dd className="font-mono text-[12px]">{providers.data.index_mode}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-line py-2">
            <dt className="text-ink-muted">Storage</dt>
            <dd className="font-mono text-[12px]">{providers.data.storage}</dd>
          </div>
        </dl>
      ) : null}

      <h2 className="mb-3 mt-10 text-[13px] font-medium">Ingestion</h2>
      {ingestion.data ? (
        <>
          <p className="mb-3 text-[13px] text-ink-muted">
            Counts by status: {JSON.stringify(ingestion.data.counts || {})}
          </p>
          {(ingestion.data.recent_failures || []).length === 0 ? (
            <p className="text-[13px] text-ink-muted">No recent ingestion failures.</p>
          ) : (
            <ul className="divide-y divide-line border border-line bg-surface">
              {ingestion.data.recent_failures.map((item) => (
                <li key={item.id} className="px-3 py-2 text-[13px]">
                  <Link className="font-medium hover:underline" to={`/documents/${item.id}`}>
                    {item.title}
                  </Link>
                  <p className="text-bad">{item.error_message}</p>
                  <p className="font-mono text-[11px] text-ink-faint">{formatTimestamp(item.updated_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {info.data ? (
        <p className="mt-8 text-[12px] text-ink-faint">
          {info.data.app_name} {info.data.version} · {info.data.environment}
        </p>
      ) : null}
    </div>
  );
}
