export function FilterSelect({ label, value, onChange, options, allowAll = true }) {
  return (
    <label className="block text-[12px] text-ink-muted">
      {label}
      <select
        className="mt-1 block h-8 w-full border border-line bg-surface px-2 text-[13px] text-ink"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowAll ? <option value="">All</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
