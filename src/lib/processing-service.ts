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
import { renderPdfToImages } from "@/lib/pdf-renderer";
import { readStoredFile } from "@/lib/storage";
import type { AggregatedFolderNode, ProcessingProgressSnapshot, ProcessingRunStatus } from "./processing-types";

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

function serializeJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify(String(value));
  }
}

function parseJsonValue<T>(value: unknown): T | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    if (!value.trim()) {
      return value as unknown as T;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      return value as unknown as T;
    }
  }

  return value as T;
}

function parseJsonArray<T>(value: unknown): T[] {
  const parsed = parseJsonValue<T[]>(value);
  return Array.isArray(parsed) ? parsed : [];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject<T>(value: unknown): T | null {
  const parsed = parseJsonValue<T>(value);
  return isPlainObject(parsed) ? (parsed as T) : null;
}

function countRecordsFromOutput(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    if (Array.isArray(candidate.records)) {
      return candidate.records.length;
    }
    if (typeof candidate.recordCount === "number") {
      const numeric = Number(candidate.recordCount);
      return Number.isFinite(numeric) ? numeric : 0;
    }
  }
  return 0;
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
      context: serializeJson(context)
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

function estimateTokensForPage(page: DocumentPage): number {
  let total = approximateTokenCount(page.textContent);
  if (!page.images?.length) {
    return total;
  }

  for (const image of page.images) {
    if (!image?.data) continue;
    total += Math.ceil(image.data.length / 4);
  }

  return total;
}

function normalizeMimeType(input: string | null | undefined): string | null {
  if (!input) return null;
  const [value] = input.split(";");
  const trimmed = value?.trim().toLowerCase();
  return trimmed?.length ? trimmed : null;
}

function sniffImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6) {
    const signature = buffer.toString("ascii", 0, 6);
    if (signature === "GIF87a" || signature === "GIF89a") {
      return "image/gif";
    }
  }
  if (buffer.length >= 12) {
    const riff = buffer.toString("ascii", 0, 4);
    const format = buffer.toString("ascii", 8, 12);
    if (riff === "RIFF" && format === "WEBP") {
      return "image/webp";
    }
    if (riff === "RIFF") {
      const brand = format.toLowerCase();
      if (["avif", "avis", "av01"].includes(brand)) {
        return "image/avif";
      }
    }
  }
  if (buffer.length >= 4) {
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      return "image/bmp";
    }
    const littleTiff = buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00;
    const bigTiff = buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a;
    if (littleTiff || bigTiff) {
      return "image/tiff";
    }
  }
  if (buffer.length >= 12) {
    const brand = buffer.toString("ascii", 8, 12).toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }
  return null;
}

function mimeFromExtension(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const normalized = fileName.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot === -1 || lastDot === normalized.length - 1) {
    return null;
  }
  const ext = normalized.slice(lastDot + 1);
  const mapping: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jpe: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
    heic: "image/heic",
    heif: "image/heic",
    avif: "image/avif",
    svg: "image/svg+xml"
  };
  return mapping[ext] ?? null;
}

function resolveImageMimeType(
  buffer: Buffer,
  declared?: string | null,
  fileName?: string | null
): { mimeType: string; warnings: string[] } {
  const warnings: string[] = [];
  const normalizedDeclared = normalizeMimeType(declared);

  if (normalizedDeclared) {
    if (normalizedDeclared.startsWith("image/")) {
      return { mimeType: normalizedDeclared, warnings };
    }
    warnings.push(
      `Received non-image content type (${normalizedDeclared}); attempting to infer the correct image MIME type.`
    );
  }

  const sniffed = sniffImageMimeType(buffer);
  if (sniffed) {
    if (normalizedDeclared && normalizedDeclared !== sniffed) {
      warnings.push(
        `Provided MIME type ${normalizedDeclared} did not match the detected type ${sniffed}. Using the detected type.`
      );
    }
    return { mimeType: sniffed, warnings };
  }

  const inferred = mimeFromExtension(fileName);
  if (inferred) {
    warnings.push(`Unable to verify MIME type from binary data. Falling back to ${inferred} based on the file name.`);
    return { mimeType: inferred, warnings };
  }

  warnings.push("Unable to determine image MIME type. Defaulting to image/png.");
  return { mimeType: "image/png", warnings };
}

async function loadDocumentPages(file: ProjectFileRow, project: ProjectRow): Promise<DocumentLoadResult> {
  const buffer = await readStoredFile(file.storagePath);
  if (!buffer) {
    throw new ProcessingRunError("Stored file is no longer available", { retryable: false });
  }

  const pages: DocumentPage[] = [];
  const warnings: string[] = [];

  if (project.fileType === "image") {
    const { mimeType, warnings: mimeWarnings } = resolveImageMimeType(buffer, file.contentType, file.originalName);
    warnings.push(...mimeWarnings);

    pages.push({
      pageNumber: 1,
      textContent: null,
      images: [
        {
          data: buffer.toString("base64"),
          mimeType,
          source: file.originalName,
          byteLength: buffer.length
        }
      ],
      metadata: {
        originalName: file.originalName,
        sizeBytes: buffer.length
      }
    });
  } else if (project.fileType === "pdf") {
    let textSegments: string[] | null = null;
    try {
      const parsePdf = await getPdfParser();
      const parsed = await parsePdf(buffer);
      const text = parsed.text ?? "";
      const segments = text.split(/\f/g);
      textSegments = segments.length ? segments : [text];
    } catch (error) {
      const message =
        error instanceof Error
          ? `Failed to parse PDF for text extraction: ${error.message}`
          : "Failed to parse PDF for text extraction.";
      warnings.push(`${message} Continuing with rendered pages.`);
    }

    let renderResult;
    try {
      renderResult = await renderPdfToImages(buffer, { maxPages: MAX_PAGES_PER_RUN });
    } catch (error) {
      const message =
        error instanceof Error
          ? `Failed to render PDF pages as images: ${error.message}`
          : "Failed to render PDF pages as images.";
      throw new ProcessingRunError(message, { retryable: false });
    }

    const { pages: renderedPages, totalPages } = renderResult;
    if (!renderedPages.length) {
      throw new ProcessingRunError("No renderable pages were found in the PDF", { retryable: false });
    }

    renderedPages.forEach((renderedPage) => {
      const pageIndex = renderedPage.pageNumber - 1;
      const segment = textSegments ? textSegments[pageIndex] ?? "" : "";
      let textContent: string | null = null;

      if (textSegments) {
        const trimmed = segment.trim();
        if (trimmed) {
          const { value, truncated } = truncateForPrompt(trimmed);
          textContent = value;
          if (truncated) {
            warnings.push(
              `Page ${renderedPage.pageNumber} text was truncated to ${MAX_TEXT_PER_PAGE} characters for processing.`
            );
          }
        } else {
          warnings.push(`Page ${renderedPage.pageNumber} did not include extractable text.`);
        }
      }

      const imageBuffer = renderedPage.data;
      const metadata: Record<string, unknown> = {
        originalName: file.originalName,
        width: renderedPage.width,
        height: renderedPage.height,
        byteSize: imageBuffer.length
      };

      if (!textContent) {
        metadata.note = "Text extraction was unavailable; rely on the rendered image for analysis.";
      }

      pages.push({
        pageNumber: renderedPage.pageNumber,
        textContent,
        images: [
          {
            data: imageBuffer.toString("base64"),
            mimeType: renderedPage.mimeType,
            source: file.originalName,
            byteLength: imageBuffer.length
          }
        ],
        metadata
      });
    });

    if (totalPages > MAX_PAGES_PER_RUN) {
      warnings.push(
        `Only the first ${MAX_PAGES_PER_RUN} pages were processed due to safety limits. Remaining pages were skipped.`
      );
    }
  } else {
    throw new ProcessingRunError("Unsupported project file type", { retryable: false });
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
  const payload: Record<string, unknown> = {
    status,
    updatedAt: sql`now()`
  };

  if (updates) {
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        continue;
      }

      if (key === "warnings" || key === "aggregatedOutput" || key === "usageSummary") {
        payload[key] = serializeJson(value);
        continue;
      }

      payload[key] = value;
    }
  }

  await db
    .updateTable("projectProcessingRun")
    .set(payload)
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
    entries: serializeJson(result.entries.length ? result.entries : null),
    rawResponse: result.rawResponse ?? null,
    warnings: serializeJson(result.warnings?.length ? result.warnings : null),
    error: result.error ?? null,
    usage: serializeJson(result.tokenUsage ?? null)
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
      (total, page) => total + estimateTokensForPage(page),
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
    warnings: parseJsonArray<string>(row.warnings),
    usageSummary: parseJsonObject<TokenUsageSummary>(row.usageSummary),
    fileName: row.fileName ?? null,
    fileSize: normalizeNumber(row.fileSize)
  }));
}

export async function getProcessingProgress(projectId: string): Promise<ProcessingProgressSnapshot> {
  const db = getDb() as any;
  const totalRow = await db
    .selectFrom("projectFile")
    .select(sql<number>`count(*)`.as("total"))
    .where("projectId", "=", projectId)
    .executeTakeFirst();

  const statusRow = await db
    .selectFrom("projectProcessingRun")
    .select([
      sql<number>`count(distinct case when status in ('succeeded','completed_with_errors','failed','cancelled') then "fileId" end)`
        .as("completed"),
      sql<number>`count(distinct case when status in ('pending','running') then "fileId" end)`.as("active")
    ])
    .where("projectId", "=", projectId)
    .executeTakeFirst();

  const totalFiles = Number(totalRow?.total ?? 0);
  const completedFiles = Number(statusRow?.completed ?? 0);
  const activeFiles = Number(statusRow?.active ?? 0);

  return { totalFiles, completedFiles, activeFiles };
}

function toTimestampValue(value: Date | string | null | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function updateFolderCounts(node: AggregatedFolderNode): number {
  if (node.type === "file") {
    return node.recordCount;
  }
  if (!node.children || !node.children.length) {
    node.recordCount = 0;
    return 0;
  }
  node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  let total = 0;
  for (const child of node.children) {
    total += updateFolderCounts(child);
  }
  node.recordCount = total;
  return total;
}

export async function aggregateResultsByFolder(projectId: string): Promise<AggregatedFolderNode[]> {
  const db = getDb() as any;
  const rows = (await db
    .selectFrom("projectProcessingRun as run")
    .leftJoin("projectFile as file", "file.id", "run.fileId")
    .select([
      "run.id as runId",
      "run.fileId as fileId",
      "run.status as status",
      "run.aggregatedOutput as aggregatedOutput",
      "run.createdAt as createdAt",
      "file.originalName as originalName"
    ])
    .where("run.projectId", "=", projectId)
    .orderBy("run.createdAt", "desc")
    .execute()) as {
    runId: string;
    fileId: string | null;
    status: ProcessingRunStatus;
    aggregatedOutput: unknown;
    createdAt: Date | string | null;
    originalName: string | null;
  }[];

  if (!rows.length) {
    return [];
  }

  type AggregationEntry = {
    runId: string;
    status: ProcessingRunStatus;
    aggregatedOutput: unknown;
    recordCount: number;
    segments: string[];
    createdAtMs: number;
    path: string;
  };

  const latestByFile = new Map<string, AggregationEntry>();

  for (const row of rows) {
    const key = row.fileId ?? row.runId;
    const createdAtMs = toTimestampValue(row.createdAt);
    const normalizedName = (row.originalName ?? row.runId).replace(/\\/g, "/").replace(/^\/+/, "");
    const segments = normalizedName ? normalizedName.split(/\/+|\\+/).filter(Boolean) : [row.runId];
    const parsed = parseJsonValue<unknown>(row.aggregatedOutput);
    const entry: AggregationEntry = {
      runId: row.runId,
      status: row.status,
      aggregatedOutput: parsed,
      recordCount: countRecordsFromOutput(parsed),
      segments: segments.length ? segments : [row.runId],
      createdAtMs,
      path: segments.join("/") || row.runId
    };
    const existing = latestByFile.get(key);
    if (!existing || entry.createdAtMs > existing.createdAtMs) {
      latestByFile.set(key, entry);
    }
  }

  const root: AggregatedFolderNode = {
    name: "root",
    path: "",
    type: "folder",
    recordCount: 0,
    children: []
  };

  for (const entry of latestByFile.values()) {
    let current = root;
    entry.segments.forEach((segment, index) => {
      const isLast = index === entry.segments.length - 1;
      const path = current.path ? `${current.path}/${segment}` : segment;
      if (!current.children) {
        current.children = [];
      }
      let child = current.children.find((node) => node.name === segment);
      if (!child) {
        child = {
          name: segment,
          path,
          type: isLast ? "file" : "folder",
          recordCount: 0,
          children: isLast ? undefined : []
        } as AggregatedFolderNode;
        current.children.push(child);
      }
      if (isLast) {
        child.recordCount = entry.recordCount;
        child.runId = entry.runId;
        child.status = entry.status;
        child.records = entry.aggregatedOutput;
      }
      current = child;
    });
  }

  if (root.children) {
    for (const child of root.children) {
      updateFolderCounts(child);
    }
    root.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  }

  return root.children ?? [];
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
      warnings: parseJsonArray<string>(run.warnings),
      aggregatedOutput: parseJsonValue<unknown>(run.aggregatedOutput),
      usageSummary: parseJsonObject<TokenUsageSummary>(run.usageSummary)
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
      entries: parseJsonArray<Record<string, unknown>>(page.entries),
      rawResponse: page.rawResponse,
      warnings: parseJsonArray<string>(page.warnings),
      error: page.error,
      usage: parseJsonObject<TokenUsageSummary>(page.usage),
      createdAt: toIso(page.createdAt),
      updatedAt: toIso(page.updatedAt)
    })),
    events: events.map((event) => ({
      id: event.id,
      level: event.level,
      message: event.message,
      context: parseJsonValue<unknown>(event.context),
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
