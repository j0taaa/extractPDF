import { logRunEvent, processRun, ProcessingRunError } from "@/lib/processing-service";

const DEFAULT_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.OPENROUTER_CONCURRENCY ?? "2", 10)
);

const DEFAULT_MAX_ATTEMPTS = Math.max(
  1,
  Number.parseInt(process.env.OPENROUTER_MAX_ATTEMPTS ?? "3", 10)
);

const DEFAULT_BASE_DELAY_MS = Math.max(
  500,
  Number.parseInt(process.env.OPENROUTER_RETRY_BASE_MS ?? "2000", 10)
);

const DEFAULT_MAX_DELAY_MS = Math.max(
  DEFAULT_BASE_DELAY_MS,
  Number.parseInt(process.env.OPENROUTER_RETRY_MAX_MS ?? "60000", 10)
);

type QueueJob = {
  runId: string;
  attempt: number;
};

type ProcessingQueueOptions = {
  concurrency?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

class ProcessingQueue {
  private readonly concurrency: number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private active = 0;
  private queue: QueueJob[] = [];
  private running = new Set<string>();
  private scheduled = new Map<string, NodeJS.Timeout>();

  constructor(options?: ProcessingQueueOptions) {
    this.concurrency = Math.max(1, options?.concurrency ?? DEFAULT_CONCURRENCY);
    this.maxAttempts = Math.max(1, options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.baseDelayMs = Math.max(500, options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
    this.maxDelayMs = Math.max(this.baseDelayMs, options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS);
  }

  enqueue(runId: string) {
    if (this.running.has(runId)) return;
    if (this.queue.some((job) => job.runId === runId)) return;
    if (this.scheduled.has(runId)) return;

    this.queue.push({ runId, attempt: 1 });
    this.processNext();
  }

  private processNext() {
    if (this.active >= this.concurrency) {
      return;
    }

    const job = this.queue.shift();
    if (!job) {
      return;
    }

    this.active += 1;
    this.running.add(job.runId);

    this.execute(job)
      .catch((error) => {
        console.error("Processing queue encountered an unexpected error", error);
      })
      .finally(() => {
        this.running.delete(job.runId);
        this.active = Math.max(0, this.active - 1);
        this.processNext();
      });
  }

  private async execute(job: QueueJob) {
    try {
      await processRun(job.runId, job.attempt);
    } catch (error) {
      if (error instanceof ProcessingRunError && error.retryable) {
        if (job.attempt >= this.maxAttempts) {
          await logRunEvent(job.runId, "error", "Max retry attempts reached", {
            attempts: job.attempt,
            reason: error.message
          });
          return;
        }

        const nextAttempt = job.attempt + 1;
        const delay = this.computeDelay(job.attempt);
        await logRunEvent(job.runId, "warn", `Retrying in ${Math.round(delay / 1000)} seconds`, {
          attempt: nextAttempt,
          delayMs: delay,
          reason: error.message
        });
        this.schedule(job.runId, nextAttempt, delay);
        return;
      }

      if (!(error instanceof ProcessingRunError)) {
        const message = error instanceof Error ? error.message : "Unknown processing error";
        await logRunEvent(job.runId, "error", message);
      }
    }
  }

  private schedule(runId: string, attempt: number, delay: number) {
    const timer = setTimeout(() => {
      this.scheduled.delete(runId);
      this.queue.push({ runId, attempt });
      this.processNext();
    }, delay);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
    this.scheduled.set(runId, timer);
  }

  private computeDelay(attempt: number): number {
    const exponent = Math.max(0, attempt - 1);
    const delay = this.baseDelayMs * Math.pow(2, exponent);
    return Math.min(delay, this.maxDelayMs);
  }
}

const defaultQueue = new ProcessingQueue();

export function getProcessingQueue() {
  return defaultQueue;
}

export function enqueueProcessingRun(runId: string) {
  defaultQueue.enqueue(runId);
}
