export function StatusDot({ tone, label }) {
  const fill = {
    ok: "bg-ok",
    warn: "bg-warn",
    bad: "bg-bad",
    neutral: "bg-ink-faint",
  }[tone];

  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-ink-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${fill}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
