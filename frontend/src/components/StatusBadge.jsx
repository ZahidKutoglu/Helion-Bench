const OK = new Set(["indexed", "ok", "healthy", "sufficient", "pass", "passed"]);
const BAD = new Set(["failed", "error", "insufficient", "unavailable", "fail", "failed_eval"]);

export function StatusBadge({ status }) {
  const value = String(status || "unknown");
  const tone = OK.has(value)
    ? "text-ok bg-ok-soft"
    : BAD.has(value)
      ? "text-bad bg-bad-soft"
      : "text-warn bg-warn-soft";
  return (
    <span className={`inline-block px-1.5 py-0.5 font-mono text-[11px] ${tone}`}>{value}</span>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="mb-4 border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad">
      <p>{error.message || String(error)}</p>
      {onRetry ? (
        <button type="button" className="mt-2 text-[12px] underline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body }) {
  return (
    <div className="max-w-xl">
      <h2 className="text-[16px] font-medium">{title}</h2>
      <p className="mt-2 text-[13px] leading-6 text-ink-muted">{body}</p>
    </div>
  );
}
