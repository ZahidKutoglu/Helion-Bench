import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { FilterSelect } from "../components/FilterSelect";
import { PageHeader } from "../components/PageHeader";
import { ErrorBanner, StatusBadge } from "../components/StatusBadge";
import { formatTimestamp, getCatalog, getDocuments } from "../lib/api";

const EVIDENCE_TYPES = ["failure_report", "test_specification", "investigation_record"];

export function TestEvidencePage() {
  const [documentType, setDocumentType] = useState("failure_report");
  const [component, setComponent] = useState("");
  const [version, setVersion] = useState("");
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: getCatalog });
  const list = useQuery({
    queryKey: ["evidence", documentType, component, version],
    queryFn: () =>
      getDocuments({
        document_type: documentType,
        component,
        version,
      }),
  });

  return (
    <div>
      <PageHeader
        kicker="Runs"
        title="Test Evidence"
        description="Failure reports, test specifications, and historical investigation records from the document store. This is not a fabricated pass/fail dashboard."
      />
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <FilterSelect
          label="Record type"
          value={documentType}
          options={EVIDENCE_TYPES}
          allowAll={false}
          onChange={setDocumentType}
        />
        <FilterSelect
          label="Component"
          value={component}
          options={catalog.data?.components || []}
          onChange={setComponent}
        />
        <FilterSelect
          label="Build"
          value={version}
          options={catalog.data?.versions || []}
          onChange={setVersion}
        />
      </div>
      <ErrorBanner error={list.error} onRetry={() => list.refetch()} />
      {list.isPending ? <p className="text-[13px] text-ink-muted">Loading…</p> : null}
      {!list.isPending && (list.data?.items || []).length === 0 ? (
        <p className="text-[13px] text-ink-muted">No records of this type are indexed yet.</p>
      ) : null}
      <ul className="divide-y divide-line border border-line bg-surface">
        {(list.data?.items || []).map((doc) => (
          <li key={doc.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link className="text-[14px] font-medium hover:underline" to={`/documents/${doc.id}`}>
                {doc.title}
              </Link>
              <StatusBadge status={doc.status} />
            </div>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {doc.id} · {doc.component} · {doc.version} · {formatTimestamp(doc.created_at)}
            </p>
            {doc.error_message ? <p className="mt-2 text-[12px] text-bad">{doc.error_message}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
