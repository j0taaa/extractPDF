"use client";

import { useCallback, useMemo, useState } from "react";

import type { ProcessingProgressSnapshot } from "@/lib/processing-types";

type ProjectFile = {
  id: string;
  originalName: string;
  size: number;
  contentType: string | null;
  uploadedViaApi: boolean;
  createdAt: string;
};

type Props = {
  projectId: string;
  initialFiles: ProjectFile[];
  progress: ProcessingProgressSnapshot;
  onProgressChange: (progress: ProcessingProgressSnapshot) => void;
};

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}

function parseUploadResponse(payload: unknown): { files: ProjectFile[]; warnings: string[] } {
  if (!payload || typeof payload !== "object") {
    return { files: [], warnings: [] };
  }

  const data = payload as Record<string, unknown>;
  const rawFiles = Array.isArray(data.files)
    ? data.files
    : data.file && typeof data.file === "object"
      ? [data.file]
      : [];

  const files: ProjectFile[] = rawFiles.filter((entry): entry is ProjectFile => {
    if (!entry || typeof entry !== "object") return false;
    const candidate = entry as ProjectFile;
    return typeof candidate.id === "string" && typeof candidate.originalName === "string";
  });

  const warnings = Array.isArray(data.warnings)
    ? data.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  return { files, warnings };
}

export function ProjectFilesPanel({ projectId, initialFiles, progress, onProgressChange }: Props) {
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasFiles = useMemo(() => files.length > 0, [files]);
  const completionRatio = useMemo(() => {
    if (!progress || progress.totalFiles <= 0) {
      return 0;
    }
    const ratio = progress.completedFiles / progress.totalFiles;
    return Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;
  }, [progress.completedFiles, progress.totalFiles]);
  const progressPercent = Math.round(completionRatio * 100);
  const progressWidth = Math.min(100, Math.max(0, progressPercent));
  const progressSummary = progress.totalFiles > 0
    ? `${progress.completedFiles} of ${progress.totalFiles} files processed`
    : "No files uploaded yet.";
  const activeLabel = progress.activeFiles > 0 ? `${progress.activeFiles} currently processing` : null;

  const refreshProgress = useCallback(async () => {
    setProgressLoading(true);
    setProgressError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/processing/progress`);
      if (!response.ok) {
        throw new Error(`Failed to load progress (${response.status})`);
      }
      const payload = (await response.json().catch(() => null)) as ProcessingProgressSnapshot | null;
      if (!payload || typeof payload.totalFiles !== "number") {
        throw new Error("Unexpected response when loading progress");
      }
      onProgressChange(payload);
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : "Unable to refresh progress");
    } finally {
      setProgressLoading(false);
    }
  }, [projectId, onProgressChange]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedFile || status === "uploading") return;

    setStatus("uploading");
    setError(null);
    setSuccessMessage(null);
    setUploadWarnings([]);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: formData
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        const message = payload && typeof (payload as any).error === "string" ? (payload as any).error : "Upload failed";
        throw new Error(message);
      }

      const { files: uploadedFiles, warnings } = parseUploadResponse(payload);
      if (!uploadedFiles.length) {
        const message =
          payload && typeof (payload as any).error === "string"
            ? (payload as any).error
            : "Upload succeeded but returned no files.";
        throw new Error(message);
      }

      setFiles((previous) => [...uploadedFiles, ...previous]);
      setUploadWarnings(warnings);
      setSuccessMessage(
        uploadedFiles.length === 1
          ? `Uploaded ${uploadedFiles[0].originalName}.`
          : `Uploaded ${uploadedFiles.length} files.`
      );
      setSelectedFile(null);
      const input = form.elements.namedItem("file") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      await refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setStatus("idle");
    }
  };

  const handleDelete = async (fileId: string) => {
    if (deletingId) return;
    const confirmed = typeof window !== "undefined" ? window.confirm("Remove this file from the project?") : true;
    if (!confirmed) return;

    setDeletingId(fileId);
    setError(null);
    try {
      const target = files.find((file) => file.id === fileId);
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload && typeof (payload as any).error === "string"
            ? (payload as any).error
            : "Failed to delete file";
        throw new Error(message);
      }

      setFiles((previous) => previous.filter((file) => file.id !== fileId));
      setSuccessMessage(target ? `Removed ${target.originalName}.` : "File removed.");
      setUploadWarnings([]);
      await refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Project files</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Upload PDF or image files directly into this project. Files are stored in the configured storage directory so they
          can be processed later.
        </p>
    </div>

    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Processing progress</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{progressSummary}</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => refreshProgress()}
          disabled={progressLoading}
        >
          {progressLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
          style={{ width: `${progressWidth}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <span>{progressPercent}% complete</span>
        {activeLabel ? <span>• {activeLabel}</span> : null}
      </div>
      {progressError ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{progressError}</p> : null}
    </div>

    {successMessage ? (
      <p className="text-sm text-emerald-600 dark:text-emerald-300">{successMessage}</p>
    ) : null}

    {uploadWarnings.length ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-400/50 dark:bg-amber-900/30 dark:text-amber-100">
        <p className="font-medium">Archive warnings</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {uploadWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    ) : null}

    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-700">
        <label className="block text-sm font-medium">Upload a file</label>
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setSelectedFile(file);
            setError(null);
          }}
          className="input"
        />
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          {selectedFile ? <span>{selectedFile.name}</span> : <span>No file selected</span>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!selectedFile || status === "uploading"}
          >
            {status === "uploading" ? "Uploading..." : "Upload file"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Uploaded files</h3>
        {hasFiles ? (
          <ul className="mt-3 space-y-3">
            {files.map((file) => (
              <li key={file.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{file.originalName}</p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatTimestamp(file.createdAt)}</span>
                  {file.contentType ? <span>• {file.contentType}</span> : null}
                  {file.uploadedViaApi ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                      Uploaded via API
                    </span>
                  ) : (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                      Direct upload
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <a
                    href={`/api/projects/${projectId}/files/${file.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline"
                  >
                    Open
                  </a>
                  <a
                    href={`/api/projects/${projectId}/files/${file.id}?download=1`}
                    className="btn btn-sm btn-secondary"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                    onClick={() => handleDelete(file.id)}
                    disabled={deletingId === file.id}
                  >
                    {deletingId === file.id ? "Removing..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No files uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
