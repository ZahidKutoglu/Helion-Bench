export function ThemeToggle({ theme, onToggle }) {
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => onToggle(next)}
      className="h-8 px-2.5 text-[12px] text-ink-muted hover:text-ink"
      aria-label={`Switch to ${next} mode`}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
