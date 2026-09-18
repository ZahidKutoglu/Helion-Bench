import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EvidenceList } from "../components/EvidenceList";
import { FilterSelect } from "../components/FilterSelect";
import { PageHeader } from "../components/PageHeader";
import { ErrorBanner, StatusBadge } from "../components/StatusBadge";
import {
  createInvestigation,
  formatTimestamp,
  getCatalog,
  getInvestigation,
  listInvestigations,
} from "../lib/api";

export function InvestigationsPage() {
  const { investigationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState(
    "Why did the timing synchronization test fail in build B-104?",
  );
  const [component, setComponent] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [version, setVersion] = useState("");
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: getCatalog });
  const history = useQuery({ queryKey: ["investigations"], queryFn: listInvestigations });
  const selected = useQuery({
    queryKey: ["investigation", investigationId],
    queryFn: () => getInvestigation(investigationId),
    enabled: Boolean(investigationId),
  });
  const run = useMutation({
    mutationFn: () =>
      createInvestigation({
        question,
        component: component || null,
        document_type: documentType || null,
        version: version || null,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["investigations"] });
      queryClient.setQueryData(["investigation", data.id], data);
      navigate(`/investigations/${data.id}`);
    },
  });

  const active = selected.data || run.data;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <PageHeader
          kicker="Workspace"
          title="Investigations"
          description="Ask a technical question. The system retrieves indexed chunks, builds a grounded answer, then drops any citation that is not in the retrieval set."
        />
        <form
          className="mb-8"
          onSubmit={(event) => {
            event.preventDefault();
            run.mutate();
          }}
        >
          <label className="block text-[12px] text-ink-muted">
            Question
            <textarea
              className="mt-1 block min-h-[88px] w-full border border-line bg-surface p-2 text-[14px] leading-6"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
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
          </div>
          <button
            type="submit"
            className="mt-4 h-8 bg-ink px-3 text-[12px] text-bg disabled:opacity-40"
            disabled={run.isPending}
          >
            {run.isPending ? "Retrieving and answering…" : "Run investigation"}
          </button>
        </form>
        <ErrorBanner
          error={run.error || selected.error}
          onRetry={() => (run.error ? run.mutate() : selected.refetch())}
        />
        {active ? <InvestigationResult record={active} /> : null}
        {!active && !run.isPending ? (
          <p className="text-[13px] text-ink-muted">
            Submit a question or open a record from history. Answers are not generated until retrieval
            returns.
          </p>
        ) : null}
      </div>
      <aside>
        <h2 className="mb-3 text-[13px] font-medium">History</h2>
        <ErrorBanner error={history.error} onRetry={() => history.refetch()} />
        <ul className="divide-y divide-line border border-line bg-surface">
          {(history.data || []).map((item) => (
            <li key={item.id}>
              <Link
                to={`/investigations/${item.id}`}
                className="block px-3 py-2 text-[13px] hover:bg-bg-raised"
              >
                <span className="line-clamp-2">{item.question}</span>
                <span className="mt-1 block font-mono text-[11px] text-ink-faint">
                  {formatTimestamp(item.created_at)} · {item.provider}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {history.data && history.data.length === 0 ? (
          <p className="mt-3 text-[12px] text-ink-muted">No investigations stored yet.</p>
        ) : null}
      </aside>
    </div>
  );
}

function InvestigationResult({ record }) {
  return (
    <article>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={record.evidence_coverage} />
        <span className="font-mono text-[11px] text-ink-faint">{record.provider}</span>
      </div>
      {record.provider_note ? (
        <p className="mb-4 border-l-2 border-line-strong pl-3 text-[12px] leading-5 text-ink-muted">
          {record.provider_note}
        </p>
      ) : null}
      <h2 className="text-[13px] font-medium">Answer</h2>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-[14px] leading-6">{record.answer}</pre>

      <section className="mt-8">
        <h2 className="mb-2 text-[13px] font-medium">Key findings</h2>
        <FactList items={record.key_findings} empty="None extracted from retrieved sources." />
      </section>
      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-medium">Hypotheses in the sources</h2>
        <p className="mb-2 text-[12px] text-ink-faint">
          These are possibilities recorded in the evidence, not confirmed root causes.
        </p>
        <FactList items={record.hypotheses} empty="No hypotheses were marked in the retrieved text." />
      </section>
      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-medium">Missing information</h2>
        <FactList items={record.missing_information} empty="No gaps recorded." />
      </section>
      <section className="mt-8">
        <h2 className="mb-2 text-[13px] font-medium">Validated evidence</h2>
        <EvidenceList citations={record.citations} />
      </section>
    </article>
  );
}

function FactList({ items, empty }) {
  if (!items?.length) return <p className="text-[13px] text-ink-muted">{empty}</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-[13px] leading-6 text-ink-muted">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
