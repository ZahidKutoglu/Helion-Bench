export function PageHeader({ kicker, title, description }) {
  return (
    <header className="mb-8 max-w-3xl">
      {kicker ? (
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
          {kicker}
        </p>
      ) : null}
      <h1 className="text-[28px] font-medium leading-8 tracking-[-0.035em] text-ink">{title}</h1>
      {description ? (
        <p className="mt-3 max-w-2xl text-[14px] leading-6 text-ink-muted">{description}</p>
      ) : null}
    </header>
  );
}
