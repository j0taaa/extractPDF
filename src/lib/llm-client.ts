import type { InstructionField } from "@/lib/instruction-sets";

export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";

export type ChatMessageRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
};

export type LlmCompletionOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
};

export type LlmCompletionSuccess = {
  success: true;
  output: string;
  raw?: unknown;
};

export type LlmCompletionFailure = {
  success: false;
  error: string;
  status?: number;
  raw?: unknown;
};

export type LlmCompletion = LlmCompletionSuccess | LlmCompletionFailure;

export interface LanguageModel {
  complete(messages: ChatMessage[], options?: LlmCompletionOptions): Promise<LlmCompletion>;
}

function extractMessageContent(message: any): string {
  const content = message?.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((segment) => {
        if (!segment) return "";
        if (typeof segment === "string") return segment;
        if (typeof segment?.text === "string") return segment.text;
        if (typeof segment?.content === "string") return segment.content;
        return "";
      })
      .join("\n");
  }
  if (typeof content?.text === "string") return content.text;
  return "";
}

function sanitizeHeaders(headers: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => typeof value === "string" && value.trim().length > 0)
  );
}

export class OpenRouterClient implements LanguageModel {
  private readonly apiKey: string | undefined;
  private readonly apiUrl: string;
  private readonly defaultModel: string | undefined;
  private readonly referer?: string;
  private readonly appName?: string;

  constructor(options?: {
    apiKey?: string;
    apiUrl?: string;
    defaultModel?: string;
    referer?: string;
    appName?: string;
  }) {
    this.apiKey = options?.apiKey ?? process.env.OPENROUTER_API_KEY;
    this.apiUrl = options?.apiUrl ?? process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
    this.defaultModel = options?.defaultModel ?? process.env.OPENROUTER_MODEL ?? undefined;
    this.referer = options?.referer ?? process.env.OPENROUTER_SITE_URL;
    this.appName = options?.appName ?? process.env.OPENROUTER_APP_NAME;
  }

  async complete(messages: ChatMessage[], options?: LlmCompletionOptions): Promise<LlmCompletion> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "Missing OpenRouter API key. Set OPENROUTER_API_KEY in the environment before running prompts."
      };
    }

    const model = options?.model ?? this.defaultModel ?? DEFAULT_OPENROUTER_MODEL;
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: typeof options?.temperature === "number" ? options?.temperature : 0.2,
      stream: false
    };

    if (typeof options?.maxTokens === "number") {
      body.max_tokens = options.maxTokens;
    }

    if (options?.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    let response: Response;

    try {
      response = await fetch(this.apiUrl, {
        method: "POST",
        headers: sanitizeHeaders({
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": this.referer,
          "X-Title": this.appName
        }),
        body: JSON.stringify(body)
      });
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reach OpenRouter API",
        raw: error
      };
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      return {
        success: false,
        error: errorText || `OpenRouter request failed with status ${response.status}`,
        status: response.status
      };
    }

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return {
        success: false,
        error: "Unexpected response payload from OpenRouter",
        raw: payload
      };
    }

    const [firstChoice] = Array.isArray((payload as any).choices) ? (payload as any).choices : [];
    if (!firstChoice) {
      return {
        success: false,
        error: "OpenRouter response did not include any choices",
        raw: payload
      };
    }

    const output = extractMessageContent(firstChoice.message);
    if (!output) {
      return {
        success: false,
        error: "OpenRouter response did not include any message content",
        raw: payload
      };
    }

    return {
      success: true,
      output,
      raw: payload
    };
  }
}

export function describeFieldsForPrompt(fields: InstructionField[]): string {
  if (!fields.length) return "No structured fields were provided.";
  const bulletPoints = fields
    .map((field) => `- \"${field.name}\": ${field.description}`)
    .join("\n");
  return `Each record must include the following fields:\n${bulletPoints}`;
}
