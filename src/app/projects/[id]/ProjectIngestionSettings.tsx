"use client";

import { useState } from "react";

type Props = {
  projectId: string;
  initialEnabled: boolean;
  initialToken: string | null;
};

type ApiResponse = {
  apiIngestionEnabled: boolean;
  apiToken: string | null;
};

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function ProjectIngestionSettings({ projectId, initialEnabled, initialToken }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [token, setToken] = useState<string | null>(initialToken);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const updateSettings = async (payload: Record<string, unknown>) => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/ingestion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const message = data && typeof (data as any).error === "string" ? (data as any).error : "Unable to update settings";
        throw new Error(message);
      }
      const parsed = data as ApiResponse;
      setEnabled(parsed.apiIngestionEnabled);
      setToken(parsed.apiToken ?? null);
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update settings");
    } finally {
      setStatus("idle");
    }
  };

  const toggle = () => {
    updateSettings({ apiIngestionEnabled: !enabled });
  };

  const regenerate = () => {
    updateSettings({ regenerateToken: true, apiIngestionEnabled: true });
  };

  const handleCopy = async () => {
    if (!token) return;
    const success = await copyToClipboard(token);
    setCopied(success);
    if (!success) {
      setError("Unable to copy token. Copy it manually.");
    }
  };

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-xl font-semibold">API ingestion</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Allow this project to receive files through the API. When enabled, use the generated token to authorize ingestion
          requests.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable API ingestion</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">External systems can push files with a bearer token.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
          <span className="text-gray-600 dark:text-gray-400">{enabled ? "On" : "Off"}</span>
          <input
            type="checkbox"
            className="h-5 w-10 cursor-pointer"
            checked={enabled}
            disabled={status === "loading"}
            onChange={toggle}
          />
        </label>
      </div>

      {enabled && token ? (
        <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">API token</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Send this token as a bearer credential.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={regenerate} disabled={status === "loading"}>
              Regenerate
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 whitespace-pre-wrap break-all rounded bg-gray-100 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">
              {token}
            </code>
            <button type="button" className="btn btn-outline" onClick={handleCopy} disabled={status === "loading"}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      {enabled ? (
        <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          <p className="font-medium text-gray-800 dark:text-gray-100">Endpoint</p>
          <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-100 p-3 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-100">
{`POST /api/projects/${projectId}/ingest
Authorization: Bearer ${token ?? "<token>"}
Content-Type: multipart/form-data`}
          </pre>
          <p className="mt-2">Attach the file in a form field named <code>file</code>.</p>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {status === "loading" ? <p className="text-xs text-gray-500 dark:text-gray-400">Saving changes...</p> : null}
    </div>
  );
}
