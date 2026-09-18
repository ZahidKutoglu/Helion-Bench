import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { ErrorBanner, StatusBadge } from "../components/StatusBadge";
import { deleteDocument, formatTimestamp, getDocument, reprocessDocument } from "../lib/api";

export function DocumentDetailPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
  });
  const reprocess = useMutation({
    mutationFn: () => reprocessDocument(documentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
  });
  const remove = useMutation({
    mutationFn: () => deleteDocument(documentId),
    onSuccess: () => navigate("/documents"),
  });

  const doc = detail.data;

  return (
    <div>
      <PageHeader kicker="Source" title={doc?.title || "Document"} description={doc?.id} />
      <p className="mb-4">
        <Link to="/documents" className="text-[13px] underline">
          All documents
        </Link>
      </p>
      <ErrorBanner error={detail.error} onRetry={() => detail.refetch()} />
      {detail.isPending ? <p className="text-[13px] text-ink-muted">Loading…</p> : null}
      {doc ? (
        <>
          <dl className="mb-6 grid max-w-3xl grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-[13px]">
            <dt className="text-ink-muted">Status</dt>
            <dd>
              <StatusBadge status={doc.status} />
            </dd>
            <dt className="text-ink-muted">Component</dt>
            <dd>{doc.component}</dd>
            <dt className="text-ink-muted">Type</dt>
            <dd>{doc.document_type}</dd>
            <dt className="text-ink-muted">Build</dt>
            <dd className="font-mono text-[12px]">{doc.version}</dd>
            <dt className="text-ink-muted">Source</dt>
            <dd>{doc.source}</dd>
            <dt className="text-ink-muted">Indexed</dt>
            <dd className="font-mono text-[12px]">{formatTimestamp(doc.indexed_at)}</dd>
            <dt className="text-ink-muted">Chunks</dt>
            <dd>{doc.chunk_count}</dd>
          </dl>
          {doc.error_message ? <p className="mb-4 text-[13px] text-bad">{doc.error_message}</p> : null}
          <div className="mb-6 flex gap-3">
            <button
              type="button"
              className="h-8 border border-line px-3 text-[12px]"
              onClick={() => reprocess.mutate()}
            >
              Reprocess
            </button>
            <button
              type="button"
              className="h-8 border border-bad px-3 text-[12px] text-bad"
              onClick={() => {
                if (window.confirm("Delete this document and its vectors?")) remove.mutate();
              }}
            >
              Delete
            </button>
          </div>
          <h2 className="mb-2 text-[13px] font-medium">Body</h2>
          <pre className="mb-8 overflow-x-auto whitespace-pre-wrap border border-line bg-surface p-4 font-sans text-[13px] leading-6">
            {doc.content}
          </pre>
          <h2 className="mb-2 text-[13px] font-medium">Chunks</h2>
          <ul className="space-y-3">
            {(doc.chunks || []).map((chunk) => (
              <li key={chunk.id} className="border border-line bg-surface p-3">
                <p className="font-mono text-[11px] text-ink-faint">
                  {chunk.id}
                  {chunk.section ? ` · ${chunk.section}` : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-ink-muted">
                  {chunk.content}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
