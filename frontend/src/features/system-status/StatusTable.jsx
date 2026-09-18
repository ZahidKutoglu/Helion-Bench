import { formatLatency, formatTimestamp } from "../../lib/api";

function toneClass(tone) {
  if (tone === "ok") return "text-ok";
  if (tone === "bad") return "text-bad";
  return "text-warn";
}

function Row({ name, status, latency, checked, message }) {
  const tone = status === "healthy" ? "ok" : status === "unavailable" ? "bad" : "warn";
  return (
    <tr className="border-t border-line">
      <th scope="row" className="py-3 pr-4 text-left font-medium text-ink">
        {name}
      </th>
      <td className={`py-3 pr-4 ${toneClass(tone)}`}>{status}</td>
      <td className="py-3 pr-4 font-mono text-[12px] text-ink-muted">{formatLatency(latency)}</td>
      <td className="py-3 pr-4 font-mono text-[12px] text-ink-muted">{formatTimestamp(checked)}</td>
      <td className="py-3 pr-4 text-ink-muted">{message}</td>
    </tr>
  );
}

export function StatusTable({ snapshot }) {
  const rows = [
    { name: "Browser app", ...snapshot?.browser },
    { name: "Local store", ...snapshot?.store },
    { name: "In-browser index", ...snapshot?.index },
  ];
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Live health of the browser app, local store, and in-memory index</caption>
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
          {rows.map((row) => (
            <Row
              key={row.name}
              name={row.name}
              status={row.status || "checking"}
              latency={row.latency_ms}
              checked={row.checked_at}
              message={row.message || "Waiting for a response."}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
