import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { FilterSelect } from "../components/FilterSelect";
import { PageHeader } from "../components/PageHeader";
import { ErrorBanner } from "../components/StatusBadge";
import { getCatalog, searchKnowledge } from "../lib/api";

export function KnowledgeBasePage() {
  const [query, setQuery] = useState("Why did timing synchronization fail in build B-104?");
  const [component, setComponent] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [version, setVersion] = useState("");
  const [k, setK] = useState(8);
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: getCatalog });
  const search = useMutation({
    mutationFn: () =>
      searchKnowledge({
        query,
        k: Number(k),
        component: component || null,
        document_type: documentType || null,
        version: version || null,
      }),
  });

  return (
    <div>
      <PageHeader
        kicker="Search"
        title="Knowledge Base"
        description="Hybrid search over indexed chunks. Ranking combines hashed n-gram cosine similarity with token overlap. Scores are not probabilities."
      />
      <form
        className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          search.mutate();
        }}
      >
        <label className="text-[12px] text-ink-muted lg:col-span-2">
          Query
          <input
            className="mt-1 block h-8 w-full border border-line px-2 text-[13px]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <FilterSelect
          label="Component"
          value={component}
          options={catalog.data?.components || []}
          onChange={setComponent}
        />
        <FilterSelect
          label="Type"
          value={documentType}
          options={catalog.data?.document_types || []}
          onChange={setDocumentType}
        />
        <FilterSelect
          label="Build"
          value={version}
          options={catalog.data?.versions || []}
          onChange={setVersion}
        />
        <label className="text-[12px] text-ink-muted">
          k
          <input
            type="number"
            min="1"
            max="20"
            className="mt-1 block h-8 w-full border border-line px-2 text-[13px]"
            value={k}
            onChange={(event) => setK(event.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className="h-8 bg-ink px-3 text-[12px] text-bg" disabled={search.isPending}>
            {search.isPending ? "Searching…" : "Search"}
          </button>
        </div>
      </form>
      <ErrorBanner error={search.error} />
      {search.data ? (
        search.data.hits.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No indexed chunks matched this query and filters.</p>
        ) : (
          <ul className="space-y-3">
            {search.data.hits.map((hit) => (
              <li key={hit.chunk_id} className="border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link className="text-[14px] font-medium hover:underline" to={`/documents/${hit.document_id}`}>
                    {hit.title}
                  </Link>
                  <span className="font-mono text-[11px] text-ink-faint">
                    combined {hit.combined_score} · vector {hit.vector_score} · lexical {hit.lexical_score}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-ink-faint">
                  {hit.component} · {hit.document_type} · {hit.version} · {hit.chunk_id}
                </p>
                <p className="mt-2 text-[13px] leading-6 text-ink-muted">{hit.content}</p>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-[13px] text-ink-muted">Run a search against the live index. Nothing is hardcoded.</p>
      )}
    </div>
  );
}
