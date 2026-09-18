import { PageHeader } from "../components/PageHeader";
import { useSystemInfo } from "../hooks/useHealth";

function Flag({ on, label }) {
  return (
    <li className="flex items-center justify-between border-b border-line py-2.5 text-[13px]">
      <span>{label}</span>
      <span className={on ? "text-ok" : "text-ink-faint"}>{on ? "on" : "off"}</span>
    </li>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-line py-2.5 text-[13px]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono text-[12px] text-ink">{value ?? "—"}</dd>
    </div>
  );
}

export function SettingsPage({ theme, onThemeChange }) {
  const info = useSystemInfo();
  const payload = info.data?.ok ? info.data.data : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker="Workspace"
        title="Settings"
        description="Public runtime configuration only. Database URLs, passwords, and API keys are never sent to this page."
      />

      <section className="mb-10">
        <h2 className="mb-3 text-[13px] font-medium text-ink">Appearance</h2>
        <div className="flex gap-2">
          {["light", "dark"].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onThemeChange(option)}
              className={`h-8 border px-3 text-[12px] capitalize ${
                theme === option
                  ? "border-ink bg-ink text-bg"
                  : "border-line text-ink-muted hover:text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-medium text-ink">Runtime</h2>
        {info.isPending ? (
          <p className="text-[13px] text-ink-muted">Loading configuration from the API…</p>
        ) : null}
        {info.isError || (info.data && !info.data.ok) ? (
          <p className="text-[13px] text-bad">
            Could not load /api/v1/system/info. The API is not reachable.
          </p>
        ) : null}
        {payload ? (
          <>
            <dl>
              <InfoRow label="Application" value={payload.app_name} />
              <InfoRow label="Version" value={payload.version} />
              <InfoRow label="Environment" value={payload.environment} />
              <InfoRow label="Implemented phase" value={String(payload.phase)} />
              <InfoRow label="Log level" value={payload.log_level} />
              <InfoRow label="LLM provider" value={payload.llm_provider} />
              <InfoRow label="Embedding provider" value={payload.embedding_provider} />
              <InfoRow label="Database backend" value={payload.database_backend} />
              <InfoRow label="Qdrant mode" value={payload.qdrant_mode} />
              <InfoRow
                label="OpenAI key"
                value={payload.openai_api_key_configured ? "set" : "not set"}
              />
              <InfoRow
                label="Database configured"
                value={payload.database_configured ? "yes" : "no"}
              />
              <InfoRow
                label="Qdrant URL configured"
                value={payload.qdrant_url_configured ? "yes" : "no"}
              />
              <InfoRow
                label="Qdrant API key"
                value={payload.qdrant_api_key_configured ? "set" : "not set"}
              />
              <InfoRow label="CORS origins" value={(payload.cors_origins || []).join(", ")} />
            </dl>
            <h3 className="mb-1 mt-8 text-[13px] font-medium text-ink">Feature flags</h3>
            <p className="mb-2 text-[12px] text-ink-faint">
              These reflect implemented backend capabilities, not roadmap items marked complete.
            </p>
            <ul>
              <Flag on={payload.features?.ingestion} label="Document ingestion" />
              <Flag on={payload.features?.retrieval} label="Semantic retrieval" />
              <Flag on={payload.features?.generation} label="Grounded generation" />
              <Flag on={payload.features?.evaluation} label="RAG evaluation" />
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
