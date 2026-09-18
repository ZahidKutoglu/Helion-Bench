import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { ErrorBanner, StatusBadge } from "../components/StatusBadge";
import { formatPercent, formatTimestamp, listEvaluationCases, listEvaluationRuns, runEvaluation } from "../lib/api";

export function EvaluationPage() {
  const queryClient = useQueryClient();
  const cases = useQuery({ queryKey: ["eval-cases"], queryFn: listEvaluationCases });
  const runs = useQuery({ queryKey: ["eval-runs"], queryFn: listEvaluationRuns });
  const run = useMutation({
    mutationFn: () => runEvaluation(8),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["eval-runs"] }),
  });
  const latest = run.data || runs.data?.[0];

  return (
    <div>
      <PageHeader
        kicker="Quality"
        title="Evaluation"
        description="Reproducible checks against a synthetic question set. Metrics are computed from this run, not invented. They do not generalize to real engineering corpora."
      />
      <button
        type="button"
        className="mb-6 h-8 bg-ink px-3 text-[12px] text-bg disabled:opacity-40"
        disabled={run.isPending}
        onClick={() => run.mutate()}
      >
        {run.isPending ? "Running evaluation…" : "Run evaluation"}
      </button>
      <ErrorBanner error={run.error || runs.error} onRetry={() => runs.refetch()} />

      <h2 className="mb-2 text-[13px] font-medium">Dataset</h2>
      <p className="mb-3 max-w-2xl text-[12px] text-ink-muted">
        {cases.data?.items?.length || 0} synthetic questions, including one that should have insufficient
        evidence. Expected document IDs are listed on each case.
      </p>
      <ul className="mb-8 divide-y divide-line border border-line bg-surface">
        {(cases.data?.items || []).map((item) => (
          <li key={item.id} className="px-4 py-2 text-[13px]">
            <span className="font-mono text-[11px] text-ink-faint">{item.id}</span>
            <p>{item.question}</p>
          </li>
        ))}
      </ul>

      {!latest && !run.isPending ? (
        <p className="text-[13px] text-ink-muted">No evaluation has been executed yet.</p>
      ) : null}

      {latest ? (
        <section>
          <h2 className="mb-3 text-[13px] font-medium">Latest run {latest.id}</h2>
          <dl className="mb-4 grid max-w-xl grid-cols-2 gap-2 text-[13px]">
            <dt className="text-ink-muted">Recall@k</dt>
            <dd>{formatPercent(latest.recall_at_k)}</dd>
            <dt className="text-ink-muted">Citation validity</dt>
            <dd>{formatPercent(latest.citation_validity_rate)}</dd>
            <dt className="text-ink-muted">Retrieval hit rate</dt>
            <dd>{formatPercent(latest.retrieval_hit_rate)}</dd>
            <dt className="text-ink-muted">Supported answer rate</dt>
            <dd>{formatPercent(latest.supported_answer_rate)}</dd>
            <dt className="text-ink-muted">Failed cases</dt>
            <dd>
              {latest.failed_count} / {latest.case_count}
            </dd>
            <dt className="text-ink-muted">Provider</dt>
            <dd>{latest.provider}</dd>
            <dt className="text-ink-muted">When</dt>
            <dd className="font-mono text-[12px]">{formatTimestamp(latest.created_at)}</dd>
          </dl>
          {latest.notes ? <p className="mb-4 max-w-2xl text-[12px] text-ink-faint">{latest.notes}</p> : null}
          <div className="overflow-x-auto border border-line bg-surface">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-bg-raised text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Case</th>
                  <th className="py-2 font-medium">Hit</th>
                  <th className="py-2 font-medium">Supported</th>
                  <th className="py-2 font-medium">Recall</th>
                  <th className="py-2 pr-3 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {(latest.cases || []).map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <div className="font-mono text-[11px] text-ink-faint">{row.id}</div>
                      {row.question}
                      {row.error ? <div className="text-bad">{row.error}</div> : null}
                    </td>
                    <td className="py-2">{row.retrieval_hit ? "yes" : "no"}</td>
                    <td className="py-2">{row.answer_supported ? "yes" : "no"}</td>
                    <td className="py-2">{formatPercent(row.recall_at_k)}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={row.passed ? "pass" : "fail"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
