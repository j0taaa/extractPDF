import type { InstructionField, InstructionSet } from "@/lib/instruction-sets";
import {
  type ChatMessage,
  type LanguageModel,
  OpenRouterClient,
  describeFieldsForPrompt
} from "@/lib/llm-client";

export type DocumentPage = {
  pageNumber: number;
  textContent?: string | null;
  images?: string[];
  metadata?: Record<string, unknown>;
};

export type PagePromptResult<TRecord = Record<string, unknown>> = {
  pageNumber: number;
  entries: TRecord[];
  rawResponse: string | null;
  error?: string | null;
  warnings?: string[];
};

export type PageProcessingResult<TRecord = Record<string, unknown>> = {
  combined: TRecord[];
  pages: PagePromptResult<TRecord>[];
};

export type PageProcessingOptions = {
  pages: DocumentPage[];
  workflow: Pick<InstructionSet, "name" | "summary" | "fields" | "steps">;
  customPrompt?: string | null;
  model?: string;
  temperature?: number;
  llm?: LanguageModel;
};

export type SecondaryAggregationOptions<TRecord = Record<string, unknown>> = {
  aggregatedRecords: TRecord[];
  aggregationPrompt: string;
  llm?: LanguageModel;
  model?: string;
  temperature?: number;
  customPrompt?: string | null;
  outputFields?: InstructionField[];
};

export type SecondaryAggregationResult<TOutput = Record<string, unknown>> = {
  output: TOutput | null;
  rawResponse: string | null;
  error?: string | null;
};

export async function runPageLevelPrompts<TRecord = Record<string, unknown>>(
  options: PageProcessingOptions
): Promise<PageProcessingResult<TRecord>> {
  const llm = options.llm ?? new OpenRouterClient();
  const pages: PagePromptResult<TRecord>[] = [];
  const combinedRecords: TRecord[] = [];

  for (const page of options.pages) {
    const messages = buildPageMessages({
      page,
      workflow: options.workflow,
      customPrompt: options.customPrompt
    });

    const completion = await llm.complete(messages, {
      model: options.model,
      temperature: options.temperature,
      responseFormat: "json"
    });

    if (!completion.success) {
      pages.push({
        pageNumber: page.pageNumber,
        entries: [],
        rawResponse: null,
        error: completion.error
      });
      continue;
    }

    const parsed = parseRecordsFromResponse<TRecord>(completion.output, page.pageNumber);
    if (parsed.error) {
      pages.push({
        pageNumber: page.pageNumber,
        entries: [],
        rawResponse: completion.output,
        error: parsed.error,
        warnings: parsed.warnings
      });
      continue;
    }

    combinedRecords.push(...parsed.records);
    pages.push({
      pageNumber: page.pageNumber,
      entries: parsed.records,
      rawResponse: completion.output,
      warnings: parsed.warnings.length ? parsed.warnings : undefined
    });
  }

  return {
    combined: combinedRecords,
    pages
  };
}

export async function runSecondaryAggregation<TRecord = Record<string, unknown>, TOutput = Record<string, unknown>>(
  options: SecondaryAggregationOptions<TRecord>
): Promise<SecondaryAggregationResult<TOutput>> {
  const llm = options.llm ?? new OpenRouterClient();

  if (!options.aggregatedRecords.length) {
    return {
      output: null,
      rawResponse: null,
      error: "No page-level records were provided for aggregation."
    };
  }

  const messages = buildAggregationMessages(options);
  const completion = await llm.complete(messages, {
    model: options.model,
    temperature: options.temperature,
    responseFormat: "json"
  });

  if (!completion.success) {
    return {
      output: null,
      rawResponse: null,
      error: completion.error
    };
  }

  const parsed = safeJsonParse<TOutput>(completion.output);
  if (!parsed.ok) {
    return {
      output: null,
      rawResponse: completion.output,
      error: parsed.error
    };
  }

  return {
    output: parsed.value,
    rawResponse: completion.output
  };
}

function buildPageMessages(params: {
  page: DocumentPage;
  workflow: Pick<InstructionSet, "name" | "summary" | "fields" | "steps">;
  customPrompt?: string | null;
}): ChatMessage[] {
  const { page, workflow, customPrompt } = params;
  const instructions = [
    `You are assisting with the \"${workflow.name}\" workflow for extractPDF.`,
    workflow.summary,
    "Analyze the provided page independently and produce structured JSON records.",
    "Return your response as a JSON object with a top-level \"records\" array.",
    describeFieldsForPrompt(workflow.fields),
    "Ensure every record includes a numeric \"page\" field representing the page number you analyzed.",
    "If a field is not applicable, set it to null rather than omitting it.",
    "Do not include explanatory text outside of the JSON object."
  ];

  if (workflow.steps.length) {
    instructions.push(
      "Follow these high-level steps:",
      workflow.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")
    );
  }

  if (customPrompt) {
    instructions.push("Additional project-specific guidance:", customPrompt);
  }

  const textContent = page.textContent?.trim().length ? page.textContent : "No text content was provided for this page.";

  const userContentParts = [
    `Document page number: ${page.pageNumber}.`,
    "Extracted text content:",
    """,
    textContent,
    """"
  ];

  if (page.images?.length) {
    userContentParts.push("Associated image references:", page.images.map((url) => `- ${url}`).join("\n"));
  }

  if (page.metadata && Object.keys(page.metadata).length) {
    userContentParts.push("Additional metadata:");
    userContentParts.push(JSON.stringify(page.metadata, null, 2));
  }

  return [
    {
      role: "system",
      content: instructions.join("\n\n")
    },
    {
      role: "user",
      content: userContentParts.join("\n")
    }
  ];
}

function buildAggregationMessages<TRecord>(
  options: SecondaryAggregationOptions<TRecord>
): ChatMessage[] {
  const instructions = [
    "You are an AI assistant that merges page-level extraction results into a single document-level payload.",
    "Always respond with valid JSON and avoid commentary outside of the JSON object.",
    options.aggregationPrompt
  ];

  if (options.customPrompt) {
    instructions.push("Project-level customization:", options.customPrompt);
  }

  if (options.outputFields?.length) {
    instructions.push("Structure the JSON output with these fields:", describeFieldsForPrompt(options.outputFields));
  }

  const serializedRecords = JSON.stringify(options.aggregatedRecords, null, 2);
  const userContent = [
    "Here are the page-level records you must combine:",
    """,
    serializedRecords,
    """",
    "Use the records to fulfill the aggregation request."
  ].join("\n");

  return [
    {
      role: "system",
      content: instructions.join("\n\n")
    },
    {
      role: "user",
      content: userContent
    }
  ];
}

type ParsedRecordsResult<TRecord> = {
  records: TRecord[];
  warnings: string[];
  error?: string;
};

function parseRecordsFromResponse<TRecord>(raw: string, pageNumber: number): ParsedRecordsResult<TRecord> {
  const parsed = safeJsonParse<unknown>(raw);
  if (!parsed.ok) {
    return { records: [], warnings: [], error: parsed.error };
  }

  const root = parsed.value;
  let records: unknown = null;
  if (Array.isArray((root as any)?.records)) {
    records = (root as any).records;
  } else if (Array.isArray(root)) {
    records = root;
  } else if (root && typeof root === "object") {
    records = [root];
  } else {
    return { records: [], warnings: [], error: "LLM response did not include a records array." };
  }

  const normalizedRecords: TRecord[] = [];
  const warnings: string[] = [];

  for (const item of records as unknown[]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      warnings.push("Discarded a non-object entry returned by the model.");
      continue;
    }

    const record = { ...(item as Record<string, unknown>) } as TRecord & { page?: unknown };
    if (typeof (record as any).page !== "number") {
      (record as any).page = pageNumber;
      warnings.push("Added missing page number to a record returned by the model.");
    }

    normalizedRecords.push(record as TRecord);
  }

  if (!normalizedRecords.length) {
    return {
      records: [],
      warnings,
      error: "The model response did not contain any usable records."
    };
  }

  return { records: normalizedRecords, warnings };
}

type SafeJsonParseSuccess<T> = { ok: true; value: T };
type SafeJsonParseFailure = { ok: false; error: string };

type SafeJsonParseResult<T> = SafeJsonParseSuccess<T> | SafeJsonParseFailure;

function safeJsonParse<T>(input: string): SafeJsonParseResult<T> {
  try {
    const value = JSON.parse(input) as T;
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Model response was not valid JSON"
    };
  }
}
