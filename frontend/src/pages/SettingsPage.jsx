import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { getSystemInfo, resetDemoData } from "../lib/api";

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 border-b border-line py-2.5 text-[13px]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono text-[12px] text-ink">{value ?? "—"}</dd>
    </div>
  );
}

export function SettingsPage({ theme, onThemeChange }) {
  const queryClient = useQueryClient();
  const info = useQuery({ queryKey: ["system-info"], queryFn: getSystemInfo });
  const reset = useMutation({
    mutationFn: resetDemoData,
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const payload = info.data;

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker="Workspace"
        title="Settings"
        description="This is a browser-only demo. Documents, investigations, and evaluation runs stay in localStorage on this device."
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

      <section className="mb-10">
        <h2 className="mb-3 text-[13px] font-medium text-ink">Demo corpus</h2>
        <p className="mb-3 max-w-xl text-[13px] leading-6 text-ink-muted">
          Restore the 14 synthetic Helion Wireless Lab documents. This replaces uploaded files and
          investigation history in this browser.
        </p>
        <button
          type="button"
          className="h-8 border border-line px-3 text-[12px]"
          disabled={reset.isPending}
          onClick={() => {
            if (window.confirm("Replace local demo data with the original synthetic corpus?")) {
              reset.mutate();
            }
          }}
        >
          {reset.isPending ? "Restoring…" : "Restore synthetic corpus"}
        </button>
        {reset.isSuccess ? (
          <p className="mt-2 text-[13px] text-ok">Synthetic corpus restored in this browser.</p>
        ) : null}
        {reset.isError ? <p className="mt-2 text-[13px] text-bad">{reset.error.message}</p> : null}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-medium text-ink">Runtime</h2>
        {payload ? (
          <dl>
            <InfoRow label="Application" value={payload.app_name} />
            <InfoRow label="Version" value={payload.version} />
            <InfoRow label="Environment" value={payload.environment} />
            <InfoRow label="Storage" value={payload.storage} />
            <InfoRow label="LLM provider" value={payload.llm_provider} />
            <InfoRow label="Embedding provider" value={payload.embedding_provider} />
          </dl>
        ) : null}
      </section>
    </div>
  );
}
