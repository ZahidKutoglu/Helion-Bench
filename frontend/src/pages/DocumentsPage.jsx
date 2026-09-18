import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBanner } from "../components/StatusBadge";
import { FilterSelect } from "../components/FilterSelect";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import {
  deleteDocument,
  formatTimestamp,
  getCatalog,
  getDocuments,
  reprocessDocument,
  uploadDocument,
} from "../lib/api";

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    q: "",
    component: "",
    document_type: "",
    version: "",
    status: "",
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: getCatalog });
  const list = useQuery({
    queryKey: ["documents", filters],
    queryFn: ({ signal }) => getDocuments(filters, { signal }),
  });

  const upload = useMutation({
    mutationFn: (form) => uploadDocument(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
  const reprocess = useMutation({
    mutationFn: reprocessDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });
  const remove = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  const items = list.data?.items || [];

  return (
    <div>
      <PageHeader
        kicker="Sources"
        title="Documents"
        description="Upload Markdown, text, or JSON. A document is indexed only after chunking and in-browser embedding succeed."
      />
      <UploadForm
        catalog={catalog.data}
        pending={upload.isPending}
        onSubmit={(form) => upload.mutate(form)}
      />
      <ErrorBanner error={upload.error} />
      {upload.data ? (
        <p className="mt-3 text-[13px] text-ok">
          Indexed {upload.data.title} ({upload.data.id}) with {upload.data.chunk_count} chunks.
        </p>
      ) : null}
      <div className="mb-4 mt-8 grid gap-3 md:grid-cols-6">
        <label className="block text-[12px] text-ink-muted md:col-span-2">
          Search title or ID
          <input
            className="mt-1 block h-8 w-full border border-line bg-surface px-2 text-[13px]"
            value={filters.q}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
          />
        </label>
        <FilterSelect
          label="Component"
          value={filters.component}
          options={catalog.data?.components || []}
          onChange={(value) => setFilters((current) => ({ ...current, component: value }))}
        />
        <FilterSelect
          label="Type"
          value={filters.document_type}
          options={catalog.data?.document_types || []}
          onChange={(value) => setFilters((current) => ({ ...current, document_type: value }))}
        />
        <FilterSelect
          label="Build"
          value={filters.version}
          options={catalog.data?.versions || []}
          onChange={(value) => setFilters((current) => ({ ...current, version: value }))}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          options={["pending", "processing", "indexed", "failed"]}
          onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
        />
      </div>
      <ErrorBanner error={list.error} onRetry={() => list.refetch()} />
      {list.isPending ? <p className="text-[13px] text-ink-muted">Loading documents…</p> : null}
      {!list.isPending && items.length === 0 ? (
        <p className="text-[13px] text-ink-muted">
          No documents yet. Restore the synthetic corpus from Settings or upload a file.
        </p>
      ) : null}
      {items.length ? (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-bg-raised text-[11px] uppercase tracking-[0.12em] text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Component</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Build</th>
                <th className="py-2 font-medium">Chunks</th>
                <th className="py-2 pr-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((doc) => (
                <tr key={doc.id} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <Link className="font-medium hover:underline" to={`/documents/${doc.id}`}>
                      {doc.title}
                    </Link>
                    <div className="font-mono text-[11px] text-ink-faint">{doc.id}</div>
                    {doc.error_message ? (
                      <p className="mt-1 text-[12px] text-bad">{doc.error_message}</p>
                    ) : null}
                    <div className="mt-2 flex gap-3 text-[12px]">
                      <button
                        type="button"
                        className="underline"
                        onClick={() => reprocess.mutate(doc.id)}
                      >
                        Reprocess
                      </button>
                      <button
                        type="button"
                        className="text-bad underline"
                        onClick={() => {
                          if (window.confirm(`Delete ${doc.id}?`)) remove.mutate(doc.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                  <td className="py-2">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="py-2 text-ink-muted">{doc.component}</td>
                  <td className="py-2 text-ink-muted">{doc.document_type}</td>
                  <td className="py-2 font-mono text-[12px]">{doc.version}</td>
                  <td className="py-2 font-mono text-[12px]">{doc.chunk_count}</td>
                  <td className="py-2 pr-3 font-mono text-[12px] text-ink-muted">
                    {formatTimestamp(doc.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function UploadForm({ catalog, pending, onSubmit }) {
  const [file, setFile] = useState(null);
  const types = catalog?.document_types || [];
  const components = catalog?.components || [];

  function handleSubmit(event) {
    event.preventDefault();
    const chosen = event.currentTarget.querySelector('input[type="file"]')?.files?.[0] || file;
    if (!chosen) return;
    const form = new FormData(event.currentTarget);
    form.set("file", chosen);
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line bg-surface p-4">
      <h2 className="mb-3 text-[13px] font-medium">Upload</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <label className="text-[12px] text-ink-muted">
          File
          <input
            required
            name="file"
            type="file"
            accept=".md,.markdown,.txt,.json"
            className="mt-1 block w-full text-[13px]"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <label className="text-[12px] text-ink-muted">
          Title override
          <input name="title" className="mt-1 block h-8 w-full border border-line px-2 text-[13px]" />
        </label>
        <label className="text-[12px] text-ink-muted">
          Type
          <select name="document_type" className="mt-1 block h-8 w-full border border-line px-2 text-[13px]">
            <option value="">From file / default</option>
            {types.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-ink-muted">
          Component
          <select name="component" className="mt-1 block h-8 w-full border border-line px-2 text-[13px]">
            <option value="">From file / default</option>
            {components.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-ink-muted">
          Build / version
          <input name="version" className="mt-1 block h-8 w-full border border-line px-2 text-[13px]" />
        </label>
        <label className="text-[12px] text-ink-muted">
          Source
          <input name="source" className="mt-1 block h-8 w-full border border-line px-2 text-[13px]" />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending || !file}
        className="mt-4 h-8 bg-ink px-3 text-[12px] text-bg disabled:opacity-40"
      >
        {pending ? "Indexing…" : "Upload and index"}
      </button>
    </form>
  );
}
