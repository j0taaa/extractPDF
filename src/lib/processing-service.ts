import { generateId } from "better-auth";
import { sql } from "kysely";
import { createRequire } from "module";

import { getDb } from "@/db/client";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/llm-client";
import {
  DEFAULT_INSTRUCTION_SET_ID,
  getInstructionSet,
  type InstructionSet
} from "@/lib/instruction-sets";
import {
  type DocumentPage,
  runPageLevelPrompts,
  type PagePromptResult
} from "@/lib/page-processing";
import { readStoredFile } from "@/lib/storage";

export type ProcessingRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "completed_with_errors"
  | "cancelled";

type ProjectRow = {
  id: string;
  ownerId: string;
  instructionSet: string | null;
  customPrompt: string | null;
  fileType: string;
};

type ProjectFileRow = {
  id: string;
  projectId: string;
  storagePath: string;
  originalName: string;
  contentType: string | null;
  size: string | number | bigint;
};

type ProcessingRunRow = {
  id: string;
  projectId: string;
  fileId: string;
  instructionSet: string | null;
  customPrompt: string | null;
  model: string | null;
  temperature: string | number | null;
  fileType: string | null;
  status: ProcessingRunStatus;
  error: string | null;
  warnings: unknown;
  aggregatedOutput: unknown;
  usageSummary: unknown;
  attempts: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
};

export class ProcessingRunError extends Error {
  retryable: boolean;

  constructor(message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "ProcessingRunError";
    this.retryable = options?.retryable ?? false;
  }
}

type CreateRunOptions = {
  projectId: string;
  fileId: string;
  triggeredBy?: string | null;
};

export type TokenUsageSummary = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  totalCostUsd?: number;
};

type PageUsage = TokenUsageSummary & { pageNumber: number };

type DocumentLoadResult = {
  pages: DocumentPage[];
  warnings: string[];
};

type PdfParseFn = typeof import("pdf-parse");

const requireModule = createRequire(import.meta.url);

let pdfParser: PdfParseFn | null = null;

async function getPdfParser(): Promise<PdfParseFn> {
  if (!pdfParser) {
    const mod = requireModule("pdf-parse") as unknown;
    const maybeFn: unknown = (mod as any).default ?? mod;
    if (typeof maybeFn !== "function") {
      throw new Error("Failed to load pdf-parse module");
    }
    pdfParser = maybeFn as PdfParseFn;
  }
  return pdfParser!;
}

const MAX_PAGES_PER_RUN = Math.max(
  1,
  Number.parseInt(process.env.OPENROUTER_MAX_PAGES_PER_RUN ?? "40", 10)
);

const MAX_APPROX_TOKENS_PER_RUN = Math.max(
  1000,
  Number.parseInt(process.env.OPENROUTER_MAX_TOKENS_PER_RUN ?? "60000", 10)
);

const MAX_TEXT_PER_PAGE = Math.max(
  500,
  Number.parseInt(process.env.OPENROUTER_MAX_PAGE_CHARS ?? "8000", 10)
);

const RETRYABLE_HTTP_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export async function queueProcessingForFile(options: CreateRunOptions): Promise<{ runId: string } | null> {
  const db = getDb() as any;

  const project = (await db
    .selectFrom("project")
    .select(["id", "ownerId", "instructionSet", "customPrompt", "fileType"])
    .where("id", "=", options.projectId)
    .executeTakeFirst()) as ProjectRow | undefined;

  if (!project) {
    return null;
  }

  const file = (await db
    .selectFrom("projectFile")
    .select(["id", "projectId", "storagePath", "originalName", "contentType", "size"])
    .where("projectId", "=", project.id)
    .where("id", "=", options.fileId)
    .executeTakeFirst()) as ProjectFileRow | undefined;

  if (!file) {
    return null;
  }

  const runId = generateId();
  const instructionSetId = project.instructionSet ?? DEFAULT_INSTRUCTION_SET_ID;
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  const temperature = Number.isFinite(Number(process.env.OPENROUTER_TEMPERATURE))
    ? Number(process.env.OPENROUTER_TEMPERATURE)
    : 0.2;

  await db
    .insertInto("projectProcessingRun")
    .values({
      id: runId,
      projectId: project.id,
      fileId: file.id,
      instructionSet: instructionSetId,
      customPrompt: project.customPrompt,
      model,
      temperature,
      fileType: project.fileType,
      status: "pending",
      attempts: 0
    })
    .executeTakeFirst();

  await logRunEvent(runId, "info", "Processing run queued", {
    fileName: file.originalName,
    triggeredBy: options.triggeredBy ?? "system"
  });

  return { runId };
}

export async function logRunEvent(
  runId: string,
  level: "info" | "warn" | "error",
  message: string,
  context?: Record<string, unknown>
) {
  const db = getDb() as any;
  await db
    .insertInto("projectProcessingEvent")
    .values({
      id: generateId(),
      runId,
      level,
      message,
      context: context ?? null
    })
    .executeTakeFirst();
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function approximateTokenCount(text: string | null | undefined): number {
  if (!text) return 0;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;
  return Math.ceil(normalized.length / 4);
}

function summarizeTokenUsage(pages: PageUsage[]): TokenUsageSummary | null {
  if (!pages.length) return null;
  const summary: TokenUsageSummary = {};
  for (const page of pages) {
    if (typeof page.promptTokens === "number") {
      summary.promptTokens = (summary.promptTokens ?? 0) + page.promptTokens;
    }
    if (typeof page.completionTokens === "number") {
      summary.completionTokens = (summary.completionTokens ?? 0) + page.completionTokens;
    }
    if (typeof page.totalTokens === "number") {
      summary.totalTokens = (summary.totalTokens ?? 0) + page.totalTokens;
    }
    if (typeof page.totalCostUsd === "number") {
      summary.totalCostUsd = (summary.totalCostUsd ?? 0) + page.totalCostUsd;
    }
  }
  return summary;
}

function truncateForPrompt(text: string): { value: string; truncated: boolean } {
  if (text.length <= MAX_TEXT_PER_PAGE) {
    return { value: text, truncated: false };
  }
  return {
    value: `${text.slice(0, MAX_TEXT_PER_PAGE)}\n...[truncated ${text.length - MAX_TEXT_PER_PAGE} characters]`,
    truncated: true
  };
}

async function loadDocumentPages(file: ProjectFileRow, project: ProjectRow): Promise<DocumentLoadResult> {
  const buffer = await readStoredFile(file.storagePath);
  if (!buffer) {
    throw new ProcessingRunError("Stored file is no longer available", { retryable: false });
  }

  if (project.fileType === "image") {
    throw new ProcessingRunError(
      "Image-based projects require OCR text before LLM processing. Provide OCR output for each page.",
      { retryable: false }
    );
  }

  const pages: DocumentPage[] = [];
  const warnings: string[] = [];

  if (project.fileType === "pdf") {
    const parsePdf = await getPdfParser();
    let parsed;
    try {
      parsed = await parsePdf(buffer);
    } catch (error) {
      const message =
        error instanceof Error
          ? `Failed to parse PDF for text extraction: ${error.message}`
          : "Failed to parse PDF for text extraction.";
      throw new ProcessingRunError(message, { retryable: false });
    }
    const text = parsed.text ?? "";
    const segments = text.split(/\f/g);
    const normalized = segments.length ? segments : [text];

    normalized.slice(0, MAX_PAGES_PER_RUN).forEach((segment, index) => {
      const trimmed = segment.trim();
      if (!trimmed) {
        pages.push({
          pageNumber: index + 1,
          textContent: null,
          metadata: {
            note: "No extractable text returned by the PDF parser for this page.",
            originalName: file.originalName
          }
        });
        warnings.push(`Page ${index + 1} did not include extractable text.`);
        return;
      }
      const { value, truncated } = truncateForPrompt(trimmed);
      if (truncated) {
        warnings.push(`Page ${index + 1} text was truncated to ${MAX_TEXT_PER_PAGE} characters for processing.`);
      }
      pages.push({
        pageNumber: index + 1,
        textContent: value,
        metadata: {
          originalName: file.originalName
        }
      });
    });

    if (normalized.length > MAX_PAGES_PER_RUN) {
      warnings.push(
        `Only the first ${MAX_PAGES_PER_RUN} pages were processed due to safety limits. Remaining pages were skipped.`
      );
    }
  }

  if (!pages.length) {
    throw new ProcessingRunError("No document pages were available for processing", { retryable: false });
  }

  return { pages, warnings };
}

async function updateRunStatus(
  runId: string,
  status: ProcessingRunStatus,
  updates?: Record<string, unknown>
) {
  const db = getDb() as any;
  await db
    .updateTable("projectProcessingRun")
    .set({
      status,
      updatedAt: sql`now()`,
      ...(updates ?? {})
    })
    .where("id", "=", runId)
    .executeTakeFirst();
}

async function persistPageResults(runId: string, results: PagePromptResult[]) {
  const db = getDb() as any;
  await db.deleteFrom("projectProcessingPage").where("runId", "=", runId).execute();

  if (!results.length) {
    return;
  }

  const rows = results.map((result) => ({
    id: generateId(),
    runId,
    pageNumber: result.pageNumber,
    status: result.error ? "failed" : "succeeded",
    statusCode: typeof result.statusCode === "number" ? result.statusCode : null,
    entries: result.entries.length ? result.entries : null,
    rawResponse: result.rawResponse,
    warnings: result.warnings?.length ? result.warnings : null,
    error: result.error ?? null,
    usage: result.tokenUsage ?? null
  }));

  await db.insertInto("projectProcessingPage").values(rows).execute();
}

export async function processRun(runId: string, attempt: number): Promise<void> {
  const db = getDb() as any;

  const run = (await db
    .selectFrom("projectProcessingRun")
    .selectAll()
    .where("id", "=", runId)
    .executeTakeFirst()) as ProcessingRunRow | undefined;

  if (!run) {
    throw new ProcessingRunError("Processing run was not found", { retryable: false });
  }

  if (run.status !== "pending" && run.status !== "running") {
    await logRunEvent(runId, "info", `Skipping run because status is ${run.status}.`);
    return;
  }

  const project = (await db
    .selectFrom("project")
    .select(["id", "ownerId", "instructionSet", "customPrompt", "fileType"])
    .where("id", "=", run.projectId)
    .executeTakeFirst()) as ProjectRow | undefined;

  if (!project) {
    throw new ProcessingRunError("Project was removed before processing could complete", { retryable: false });
  }

  const file = (await db
    .selectFrom("projectFile")
    .select(["id", "projectId", "storagePath", "originalName", "contentType", "size"])
    .where("projectId", "=", project.id)
    .where("id", "=", run.fileId)
    .executeTakeFirst()) as ProjectFileRow | undefined;

  if (!file) {
    throw new ProcessingRunError("Project file was removed before processing could complete", { retryable: false });
  }

  const statusUpdates: Record<string, unknown> = {
    attempts: attempt
  };
  if (!run.startedAt) {
    statusUpdates.startedAt = sql`now()`;
  }
  await updateRunStatus(runId, "running", statusUpdates);
  await logRunEvent(runId, "info", "Processing attempt started", { attempt });

  try {
    const loadResult = await loadDocumentPages(file, project);
    if (loadResult.warnings.length) {
      await logRunEvent(runId, "warn", "Document extraction produced warnings", {
        warnings: loadResult.warnings
      });
    }
    const tokenEstimate = loadResult.pages.reduce(
      (total, page) => total + approximateTokenCount(page.textContent),
      0
    );

    if (tokenEstimate > MAX_APPROX_TOKENS_PER_RUN) {
      const message =
        `Estimated token usage (${tokenEstimate}) exceeds the safety limit of ${MAX_APPROX_TOKENS_PER_RUN}. ` +
        "Reduce the document size or adjust the limit before retrying.";
      await logRunEvent(runId, "warn", message);
      await updateRunStatus(runId, "failed", {
        error: message,
        warnings: loadResult.warnings,
        completedAt: sql`now()`
      });
      return;
    }

    const workflowId = run.instructionSet ?? project.instructionSet ?? DEFAULT_INSTRUCTION_SET_ID;
    const workflow = getInstructionSet(workflowId) ?? getInstructionSet(DEFAULT_INSTRUCTION_SET_ID);
    if (!workflow) {
      throw new ProcessingRunError("No instruction set is configured for this run", { retryable: false });
    }

    const promptResult = await runPageLevelPrompts({
      pages: loadResult.pages,
      workflow: pickWorkflowFields(workflow),
      customPrompt: run.customPrompt ?? project.customPrompt ?? null,
      model: run.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
      temperature: typeof run.temperature === "number" ? run.temperature : Number(run.temperature) || 0.2
    });

    const pageUsage: PageUsage[] = promptResult.pages
      .filter((page) => !!page.tokenUsage)
      .map((page) => ({ pageNumber: page.pageNumber, ...(page.tokenUsage as TokenUsageSummary) }));

    const summary = summarizeTokenUsage(pageUsage);

    const warnings = [...loadResult.warnings];
    const pageFailures = promptResult.pages.filter((page) => page.error);
    if (pageFailures.length === loadResult.pages.length) {
      const retryableStatuses = pageFailures
        .map((page) => page.statusCode)
        .filter((status): status is number => typeof status === "number" && RETRYABLE_HTTP_STATUSES.has(status));
      if (retryableStatuses.length === pageFailures.length) {
        throw new ProcessingRunError(
          "OpenRouter returned retryable errors for every page in this run.",
          { retryable: true }
        );
      }
    }
    if (pageFailures.length) {
      warnings.push(`${pageFailures.length} page(s) failed during processing.`);
    }

    await persistPageResults(runId, promptResult.pages);

    const status: ProcessingRunStatus = pageFailures.length
      ? (promptResult.pages.length ? "completed_with_errors" : "failed")
      : "succeeded";

    await updateRunStatus(runId, status, {
      aggregatedOutput: promptResult.combined,
      usageSummary: summary,
      warnings: warnings.length ? warnings : null,
      completedAt: sql`now()`
    });

    await logRunEvent(runId, pageFailures.length ? "warn" : "info", "Processing run completed", {
      status,
      warnings,
      summary
    });
  } catch (error) {
    if (error instanceof ProcessingRunError) {
      if (error.retryable) {
        await logRunEvent(runId, "warn", error.message, { attempt, retryable: true });
      } else {
        await updateRunStatus(runId, "failed", {
          error: error.message,
          completedAt: sql`now()`
        });
        await logRunEvent(runId, "error", error.message);
      }
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unexpected error while executing the processing run";
    await logRunEvent(runId, "error", message, {
      stack: error instanceof Error ? error.stack : undefined
    });
    await updateRunStatus(runId, "failed", {
      error: message,
      completedAt: sql`now()`
    });
    throw new ProcessingRunError(message, { retryable: false });
  }
}

function pickWorkflowFields(workflow: InstructionSet): Pick<InstructionSet, "name" | "summary" | "fields" | "steps"> {
  return {
    name: workflow.name,
    summary: workflow.summary,
    fields: workflow.fields,
    steps: workflow.steps
  };
}

export async function cancelRunsForFile(fileId: string) {
  const db = getDb() as any;
  const runs = (await db
    .selectFrom("projectProcessingRun")
    .select(["id", "status"])
    .where("fileId", "=", fileId)
    .where("status", "in", ["pending", "running"])
    .execute()) as { id: string; status: ProcessingRunStatus }[];

  if (!runs.length) return;

  for (const run of runs) {
    await updateRunStatus(run.id, "cancelled", {
      error: "File was removed before processing could complete.",
      completedAt: sql`now()`
    });
    await logRunEvent(run.id, "warn", "Run cancelled because the associated file was deleted.");
  }
}

export async function listRunsForProject(projectId: string, limit = 20) {
  const db = getDb() as any;
  const rows = (await db
    .selectFrom("projectProcessingRun as run")
    .leftJoin("projectFile as file", "file.id", "run.fileId")
    .select([
      "run.id",
      "run.fileId",
      "run.status",
      "run.attempts",
      "run.createdAt",
      "run.startedAt",
      "run.completedAt",
      "run.error",
      "run.warnings",
      "run.usageSummary",
      "file.originalName as fileName",
      "file.size as fileSize"
    ])
    .where("run.projectId", "=", projectId)
    .orderBy("run.createdAt", "desc")
    .limit(limit)
    .execute()) as any[];

  return rows.map((row) => ({
    id: row.id,
    fileId: row.fileId,
    status: row.status,
    attempts: row.attempts,
    createdAt: toIso(row.createdAt),
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    error: row.error,
    warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
    usageSummary: (row.usageSummary as TokenUsageSummary | null) ?? null,
    fileName: row.fileName ?? null,
    fileSize: normalizeNumber(row.fileSize)
  }));
}

export async function getRunDetail(projectId: string, runId: string) {
  const db = getDb() as any;
  const run = (await db
    .selectFrom("projectProcessingRun")
    .selectAll()
    .where("projectId", "=", projectId)
    .where("id", "=", runId)
    .executeTakeFirst()) as ProcessingRunRow | undefined;

  if (!run) {
    return null;
  }

  const file = (await db
    .selectFrom("projectFile")
    .select(["id", "originalName", "size", "contentType", "createdAt"])
    .where("id", "=", run.fileId)
    .executeTakeFirst()) as ProjectFileRow | undefined;

  const pages = (await db
    .selectFrom("projectProcessingPage")
    .selectAll()
    .where("runId", "=", run.id)
    .orderBy("pageNumber", "asc")
    .execute()) as any[];

  const events = (await db
    .selectFrom("projectProcessingEvent")
    .selectAll()
    .where("runId", "=", run.id)
    .orderBy("createdAt", "asc")
    .limit(200)
    .execute()) as any[];

  return {
    run: {
      id: run.id,
      status: run.status,
      attempts: run.attempts,
      instructionSet: run.instructionSet,
      customPrompt: run.customPrompt,
      model: run.model,
      temperature: typeof run.temperature === "number" ? run.temperature : Number(run.temperature) || null,
      createdAt: toIso(run.createdAt),
      startedAt: toIso(run.startedAt),
      completedAt: toIso(run.completedAt),
      error: run.error,
      warnings: Array.isArray(run.warnings) ? (run.warnings as string[]) : [],
      aggregatedOutput: run.aggregatedOutput ?? null,
      usageSummary: (run.usageSummary as TokenUsageSummary | null) ?? null
    },
    file: file
      ? {
          id: file.id,
          originalName: file.originalName,
          size: normalizeNumber(file.size),
          contentType: file.contentType,
          createdAt: toIso((file as any).createdAt)
        }
      : null,
    pages: pages.map((page) => ({
      id: page.id,
      pageNumber: page.pageNumber,
      status: page.status,
      statusCode: typeof page.statusCode === "number" ? page.statusCode : null,
      entries: page.entries ?? [],
      rawResponse: page.rawResponse,
      warnings: Array.isArray(page.warnings) ? page.warnings : [],
      error: page.error,
      usage: page.usage ?? null,
      createdAt: toIso(page.createdAt),
      updatedAt: toIso(page.updatedAt)
    })),
    events: events.map((event) => ({
      id: event.id,
      level: event.level,
      message: event.message,
      context: event.context ?? null,
      createdAt: toIso(event.createdAt)
    }))
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function isRetryableStatus(status: number | undefined | null): boolean {
  if (!status) return false;
  return RETRYABLE_HTTP_STATUSES.has(status);
}
