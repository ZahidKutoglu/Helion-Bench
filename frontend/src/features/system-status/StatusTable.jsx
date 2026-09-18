import { formatLatency, formatTimestamp } from "../../lib/api";

function toneClass(tone) {
  if (tone === "ok") return "text-ok";
  if (tone === "bad") return "text-bad";
  return "text-warn";
}

function describe(result) {
  if (result.isPending) {
    return {
      status: "checking",
      tone: "warn",
      latency: null,
      checked: null,
      message: "Waiting for a response.",
    };
  }

  if (result.isError || !result.data) {
    return {
      status: "unreachable",
      tone: "bad",
      latency: null,
      checked: null,
      message: "The API did not respond. Start the backend on port 8000.",
    };
  }

  const payload = result.data.data || {};
  const raw = payload.status || "unknown";
  const status = raw === "ok" ? "healthy" : raw === "error" ? "unavailable" : raw;
  const tone = status === "healthy" ? "ok" : status === "unavailable" || status === "unreachable" ? "bad" : "warn";
  return {
    status,
    tone,
    latency: payload.latency_ms ?? null,
    checked: payload.checked_at || payload.time || null,
    message: payload.message || (payload.service ? "Process is running." : "No status payload."),
  };
}

function Row({ name, result }) {
  const row = describe(result);

  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
        {name}
      </th>
      <td className={`py-3 pr-4 ${toneClass(row.tone)}`}>{row.status}</td>
      <td className="py-3 pr-4 font-mono text-[12px] text-ink-muted">{formatLatency(row.latency)}</td>
      <td className="py-3 pr-4 font-mono text-[12px] text-ink-muted">{formatTimestamp(row.checked)}</td>
      <td className="py-3 pr-4 text-ink-muted">{row.message}</td>
    </tr>
  );
}

export function StatusTable({ api, database, qdrant }) {
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Live health of API, database, and Qdrant</caption>
        <thead className="bg-bg-raised text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          <tr>
            <th className="px-0 py-2 pl-4 pr-4 font-medium">Subsystem</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Latency</th>
            <th className="py-2 pr-4 font-medium">Checked</th>
            <th className="py-2 pr-4 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          <Row name="API process" result={api} />
          <Row name="Database" result={database} />
          <Row name="Qdrant" result={qdrant} />
        </tbody>
      </table>
    </div>
  );
}
