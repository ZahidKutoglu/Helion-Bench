import { NavLink, Outlet } from "react-router-dom";
import { StatusDot } from "../components/StatusDot";
import { ThemeToggle } from "../components/ThemeToggle";
import { summarizeReady, useReadyHealth } from "../hooks/useHealth";

const NAV = [
  {
    to: "/investigations",
    label: "Investigations",
    purpose: "Question, evidence, grounded answer",
  },
  {
    to: "/knowledge",
    label: "Knowledge Base",
    purpose: "Search indexed engineering material",
  },
  {
    to: "/documents",
    label: "Documents",
    purpose: "Upload and inspect source files",
  },
  {
    to: "/evidence",
    label: "Test Evidence",
    purpose: "Historical runs and failures",
  },
  {
    to: "/evaluation",
    label: "Evaluation",
    purpose: "Measure retrieval and answer quality",
  },
  {
    to: "/status",
    label: "System Status",
    purpose: "Live dependency health",
  },
  {
    to: "/settings",
    label: "Settings",
    purpose: "Theme and public configuration",
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-6 w-6 grid-cols-2 gap-px" aria-hidden="true">
        <span className="bg-accent" />
        <span className="bg-ink" />
        <span className="bg-ink/70" />
        <span className="bg-ink-faint" />
      </span>
      <div>
        <p className="text-[13px] font-semibold tracking-[-0.02em]">Helion Bench</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          Synthetic lab
        </p>
      </div>
    </div>
  );
}

function NavItems({ compact = false }) {
  return NAV.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        compact
          ? `whitespace-nowrap px-3 py-2 text-[13px] ${
              isActive ? "text-ink" : "text-ink-muted hover:text-ink"
            }`
          : `block rounded-sm px-3 py-2 ${
              isActive ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"
            }`
      }
    >
      {({ isActive }) =>
        compact ? (
          item.label
        ) : (
          <>
            <span className="block text-[13px] font-medium">{item.label}</span>
            <span className={`block text-[11px] ${isActive ? "text-ink-muted" : "text-ink-faint"}`}>
              {item.purpose}
            </span>
          </>
        )
      }
    </NavLink>
  ));
}

export function AppShell({ theme, onThemeChange }) {
  const ready = useReadyHealth();
  const summary = summarizeReady(ready);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-bg-raised md:flex">
          <div className="border-b border-line px-5 py-5">
            <Brand />
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Primary">
            <NavItems />
          </nav>
          <div className="border-t border-line px-5 py-4 text-[11px] text-ink-faint">
            Synthetic corpus · labeled development providers
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center justify-between border-b border-line px-4 md:px-6">
            <div className="flex items-center gap-4">
              <div className="md:hidden">
                <Brand />
              </div>
              <p className="hidden text-[12px] text-ink-muted md:block">
                Wireless sensing and communications verification
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusDot tone={summary.tone} label={summary.label} />
              <ThemeToggle theme={theme} onToggle={onThemeChange} />
            </div>
          </header>
          <nav
            className="flex gap-1 overflow-x-auto border-b border-line md:hidden"
            aria-label="Primary"
          >
            <NavItems compact />
          </nav>
          <main id="main" className="flex-1 px-4 py-6 md:px-6 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
