"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type TokenUsageSummary = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  totalCostUsd?: number;
};

type ProcessingRunSummary = {
  id: string;
  fileId: string;
  status: string;
  attempts: number;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  warnings: string[];
  usageSummary: TokenUsageSummary | null;
  fileName: string | null;
  fileSize: number | null;
};

type ProcessingSummaryTotals = {
  totalTokens: number;
  totalCostUsd: number;
  active: number;
};

type ProcessingRunDetail = {
  run: {
    id: string;
    status: string;
    attempts: number;
    instructionSet: string | null;
    customPrompt: string | null;
    model: string | null;
    temperature: number | null;
    createdAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
    warnings: string[];
    aggregatedOutput: unknown;
    usageSummary: TokenUsageSummary | null;
  };
  file: {
    id: string;
    originalName: string | null;
    size: number | null;
    contentType: string | null;
    createdAt: string | null;
  } | null;
  pages: {
    id: string;
    pageNumber: number;
    status: string;
    statusCode: number | null;
    entries: unknown[];
    rawResponse: string | null;
    warnings: string[];
    error: string | null;
    usage: TokenUsageSummary | null;
    createdAt: string | null;
    updatedAt: string | null;
  }[];
  events: {
    id: string;
    level: string;
    message: string;
    context: unknown;
    createdAt: string | null;
  }[];
};

type Props = {
  projectId: string;
  initialRuns: ProcessingRunSummary[];
  initialSummary: ProcessingSummaryTotals;
};

type LoadState = "idle" | "loading";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  completed_with_errors: "Completed with errors",
  cancelled: "Cancelled"
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  succeeded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
  completed_with_errors: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200",
  cancelled: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatTokens(value: number | undefined | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

function formatCost(value: number | undefined | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function formatBytes(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const result = value / Math.pow(1024, index);
  return `${result.toFixed(result >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const classes = STATUS_STYLES[status] ?? "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{label}</span>;
}

export function ProjectProcessingRunsPanel({ projectId, initialRuns, initialSummary }: Props) {
  const [runs, setRuns] = useState<ProcessingRunSummary[]>(initialRuns);
  const [summary, setSummary] = useState<ProcessingSummaryTotals>(initialSummary);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRuns[0]?.id ?? null);
  const [detail, setDetail] = useState<ProcessingRunDetail | null>(null);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const hasActiveRuns = useMemo(
    () => runs.some((run) => run.status === "pending" || run.status === "running"),
    [runs]
  );

  const refreshRuns = useCallback(async () => {
    setListState("loading");
    setListError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/processing`);
      if (!response.ok) {
        throw new Error(`Failed to load processing runs (${response.status})`);
      }
      const payload = (await response.json().catch(() => null)) as
        | { runs: ProcessingRunSummary[]; summary: ProcessingSummaryTotals }
        | null;
      if (!payload) {
        throw new Error("Unexpected response when loading processing runs");
      }
      setRuns(payload.runs);
      setSummary(payload.summary);
      if (!payload.runs.some((run) => run.id === selectedRunId)) {
        setSelectedRunId(payload.runs[0]?.id ?? null);
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to load processing runs");
    } finally {
      setListState("idle");
    }
  }, [projectId, selectedRunId]);

  const loadDetail = useCallback(
    async (runId: string) => {
      setDetailState("loading");
      setDetailError(null);
      try {
        const response = await fetch(`/api/projects/${projectId}/processing/${runId}`);
        if (!response.ok) {
          throw new Error(`Failed to load run details (${response.status})`);
        }
        const payload = (await response.json().catch(() => null)) as ProcessingRunDetail | null;
        if (!payload) {
          throw new Error("Unexpected response when loading run details");
        }
        setDetail(payload);
      } catch (error) {
        setDetail(null);
        setDetailError(error instanceof Error ? error.message : "Unable to load run details");
      } finally {
        setDetailState("idle");
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (selectedRunId) {
      loadDetail(selectedRunId);
    } else {
      setDetail(null);
    }
  }, [selectedRunId, loadDetail]);

  useEffect(() => {
    if (!hasActiveRuns) {
      return;
    }
    const interval = setInterval(() => {
      refreshRuns().catch(() => undefined);
    }, 7000);
    return () => clearInterval(interval);
  }, [hasActiveRuns, refreshRuns]);

  const handleSelect = (runId: string) => {
    setSelectedRunId(runId);
  };

  const activeLabel = hasActiveRuns ? `${summary.active} active` : "No active runs";

  return (
    <div className="card space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Processing runs</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Monitor OpenRouter jobs, review structured outputs, and inspect usage for each file.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{activeLabel}</span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refreshRuns()}
            disabled={listState === "loading"}
          >
            {listState === "loading" ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="font-medium text-gray-900 dark:text-gray-100">Usage summary</p>
            <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <p>Total tokens: {formatTokens(summary.totalTokens)}</p>
              <p>Total cost (USD): {formatCost(summary.totalCostUsd)}</p>
              <p>Active runs: {summary.active}</p>
            </div>
          </div>

          {listError ? <p className="text-sm text-red-600">{listError}</p> : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">History</p>
            {runs.length ? (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {runs.map((run) => {
                  const isSelected = selectedRunId === run.id;
                  return (
                    <li key={run.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(run.id)}
                        className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/40"
                            : "border-gray-200 bg-white hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {run.fileName ?? run.fileId}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Started {formatDate(run.startedAt)}</p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Tokens: {formatTokens(run.usageSummary?.totalTokens)} | Attempts: {run.attempts}
                            </p>
                          </div>
                          <StatusBadge status={run.status} />
                        </div>
                        {run.error ? (
                          <p className="mt-2 text-xs text-red-600 dark:text-red-300">{run.error}</p>
                        ) : null}
                        {run.warnings.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-600 dark:text-amber-300">
                            {run.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No processing runs yet. Upload files to kick off LLM analysis.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {selectedRunId ? (
            <RunDetailView
              runId={selectedRunId}
              detail={detail}
              state={detailState}
              error={detailError}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Select a run from the history to view page outputs and logs.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RunDetailView({
  runId,
  detail,
  state,
  error
}: {
  runId: string;
  detail: ProcessingRunDetail | null;
  state: LoadState;
  error: string | null;
}) {
  if (state === "loading") {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
        Loading run details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-sm text-red-600 dark:border-gray-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-300">
        No details available for run {runId}.
      </div>
    );
  }

  const { run, file, pages, events } = detail;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Run {run.id}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Instruction set: {run.instructionSet ?? "Custom"}
            </p>
          </div>
          <StatusBadge status={run.status} />
        </div>
        <div className="mt-4 grid gap-3 text-xs text-gray-600 dark:text-gray-400 md:grid-cols-2">
          <p>Model: {run.model ?? "Default"}</p>
          <p>Temperature: {run.temperature ?? "—"}</p>
          <p>Created: {formatDate(run.createdAt)}</p>
          <p>Started: {formatDate(run.startedAt)}</p>
          <p>Completed: {formatDate(run.completedAt)}</p>
          <p>Attempts: {run.attempts}</p>
        </div>
        {file ? (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Source file</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{file.originalName ?? file.id}</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <span>Size: {formatBytes(file.size)}</span>
              <span>Type: {file.contentType ?? "Unknown"}</span>
              <span>Uploaded: {formatDate(file.createdAt)}</span>
            </div>
          </div>
        ) : null}
        {run.error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-300">{run.error}</p>
        ) : null}
        {run.warnings.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-600 dark:text-amber-300">
            {run.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        {run.customPrompt ? (
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200">Custom prompt</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-3 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {run.customPrompt}
            </pre>
          </details>
        ) : null}
        {run.usageSummary ? (
          <div className="mt-4 grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 md:grid-cols-2">
            <p>Total tokens: {formatTokens(run.usageSummary?.totalTokens)}</p>
            <p>Total cost (USD): {formatCost(run.usageSummary?.totalCostUsd)}</p>
            <p>Prompt tokens: {formatTokens(run.usageSummary?.promptTokens)}</p>
            <p>Completion tokens: {formatTokens(run.usageSummary?.completionTokens)}</p>
          </div>
        ) : null}
      </section>

      {run.aggregatedOutput ? (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Aggregated output</p>
            <span className="text-xs text-gray-500 dark:text-gray-400">Combined structured result</span>
          </div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-3 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
            {stringify(run.aggregatedOutput)}
          </pre>
        </section>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Page results</p>
          {pages.length ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {pages.length} page{pages.length === 1 ? "" : "s"} processed
            </span>
          ) : null}
        </div>
        {pages.length ? (
          <div className="mt-4 space-y-4">
            {pages.map((page) => (
              <article
                key={page.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-900 dark:text-gray-100">Page {page.pageNumber}</p>
                  <StatusBadge status={page.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Processed: {formatDate(page.updatedAt)} | Tokens: {formatTokens(page.usage?.totalTokens)}
                  {page.statusCode ? ` | Status: ${page.statusCode}` : ""}
                </p>
                {page.error ? (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-300">{page.error}</p>
                ) : null}
                {page.warnings.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-600 dark:text-amber-300">
                    {page.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
                {page.entries.length ? (
                  <details className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-700 dark:text-gray-200">
                      Structured entries
                      <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                        {page.entries.length} item{page.entries.length === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-3 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      {stringify(page.entries)}
                    </pre>
                  </details>
                ) : null}
                {page.rawResponse ? (
                  <details className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                    <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-700 dark:text-gray-200">
                      Raw LLM response
                    </summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-3 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                      {page.rawResponse}
                    </pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-gray-300 p-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            No page-level responses were recorded for this run.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Event log</p>
          {events.length ? (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {events.length} entr{events.length === 1 ? "y" : "ies"}
            </span>
          ) : null}
        </div>
        {events.length ? (
          <ul className="mt-4 space-y-3 text-xs text-gray-600 dark:text-gray-400">
            {events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{event.level.toUpperCase()}</span>
                  <span>{formatDate(event.createdAt)}</span>
                </div>
                <p className="mt-1 text-gray-700 dark:text-gray-200">{event.message}</p>
                {event.context ? (
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-100 p-2 text-[11px] text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    {stringify(event.context)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded border border-dashed border-gray-300 p-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            No events recorded for this run.
          </p>
        )}
      </section>
    </div>
  );
}
