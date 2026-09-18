import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusTable } from "../features/system-status/StatusTable";
import { StatusBadge } from "../components/StatusBadge";
import {
  useApiHealth,
  useDatabaseHealth,
  useQdrantHealth,
  useReadyHealth,
  useSystemInfo,
} from "../hooks/useHealth";
import { formatTimestamp, getIngestionSummary, getProviders } from "../lib/api";

function ReadyBanner({ ready }) {
  if (ready.isPending) return <p className="text-[13px] text-ink-muted">Checking storage…</p>;
  if (ready.isError) {
    return (
      <p className="text-[13px] text-bad">
        The UI could not reach the API. Start the backend on port 8000.
      </p>
    );
  }
  if (ready.data?.ok && ready.data.data?.status === "ok") {
    return <p className="text-[13px] text-ok">API and storage checks succeeded.</p>;
  }
  return (
    <p className="text-[13px] text-warn">
      The API is up, but a dependency failed. Read the table before assuming search can work.
    </p>
  );
}

export function SystemStatusPage() {
  const api = useApiHealth();
  const database = useDatabaseHealth();
  const qdrant = useQdrantHealth();
  const ready = useReadyHealth();
  const info = useSystemInfo();
  const providers = useQuery({ queryKey: ["providers"], queryFn: getProviders, retry: 1 });
  const ingestion = useQuery({ queryKey: ["ingestion-summary"], queryFn: getIngestionSummary, retry: 1 });

  return (
    <div>
      <PageHeader
        kicker="Operations"
        title="System Status"
        description="Live checks only. Latency is round-trip time for the check, not an SLO."
      />
      <div className="mb-5">
        <ReadyBanner ready={ready} />
      </div>
      <StatusTable api={api} database={database} qdrant={qdrant} />

      <h2 className="mb-3 mt-10 text-[13px] font-medium">Providers</h2>
      {providers.isError ? (
        <p className="text-[13px] text-bad">Could not load provider status.</p>
      ) : null}
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
              <StatusBadge status={providers.data.embeddings.state} /> {providers.data.embeddings.name}{" "}
              — {providers.data.embeddings.message}
            </dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-line py-2">
            <dt className="text-ink-muted">Qdrant mode</dt>
            <dd className="font-mono text-[12px]">{providers.data.qdrant_mode}</dd>
          </div>
          <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-line py-2">
            <dt className="text-ink-muted">Database</dt>
            <dd className="font-mono text-[12px]">{providers.data.database_backend}</dd>
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
                  <p className="font-mono text-[11px] text-ink-faint">
                    {formatTimestamp(item.updated_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {info.data?.ok && info.data.data ? (
        <p className="mt-8 text-[12px] text-ink-faint">
          {info.data.data.app_name} {info.data.data.version} · {info.data.data.environment}
        </p>
      ) : null}
    </div>
  );
}
