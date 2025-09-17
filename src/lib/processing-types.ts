export type ProcessingRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "completed_with_errors"
  | "cancelled";

export type ProcessingProgressSnapshot = {
  totalFiles: number;
  completedFiles: number;
  activeFiles: number;
};

export type AggregatedFolderNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  recordCount: number;
  runId?: string;
  status?: ProcessingRunStatus;
  records?: unknown;
  children?: AggregatedFolderNode[];
};
