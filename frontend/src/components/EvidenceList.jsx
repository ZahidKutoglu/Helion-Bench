import { Link } from "react-router-dom";

export function EvidenceList({ citations, empty = "No validated citations." }) {
  if (!citations?.length) {
    return <p className="text-[13px] text-ink-muted">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-line border border-line bg-surface">
      {citations.map((item) => (
        <li key={item.chunk_id} className="px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Link
              className="text-[13px] font-medium underline-offset-2 hover:underline"
              to={`/documents/${item.document_id}`}
            >
              {item.title || item.document_id}
            </Link>
            <span className="font-mono text-[11px] text-ink-faint">{item.chunk_id}</span>
          </div>
          {item.section ? (
            <p className="mt-1 font-mono text-[11px] text-ink-faint">{item.section}</p>
          ) : null}
          <p className="mt-2 text-[13px] leading-6 text-ink-muted">{item.excerpt || item.content}</p>
          <p className="mt-2 font-mono text-[11px] text-ink-faint">
            {item.component} · {item.version}
            {item.combined_score != null ? ` · rank ${item.combined_score}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
