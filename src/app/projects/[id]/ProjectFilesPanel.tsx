"use client";

import { useMemo, useState } from "react";

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

export function ProjectFilesPanel({ projectId, initialFiles }: Props) {
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const hasFiles = useMemo(() => files.length > 0, [files]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!selectedFile || status === "uploading") return;

    setStatus("uploading");
    setError(null);
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

      const uploaded = payload as ProjectFile;
      setFiles((previous) => [uploaded, ...previous]);
      setSelectedFile(null);
      const input = form.elements.namedItem("file") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
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
