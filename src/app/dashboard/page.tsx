"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_INSTRUCTION_SET_ID,
  FILE_TYPES,
  INSTRUCTION_SETS,
  type FileType,
  type InstructionSetId,
  getInstructionSet
} from "@/lib/instruction-sets";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  fileType: FileType;
  instructionSet: InstructionSetId;
  customPrompt?: string | null;
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fileType, setFileType] = useState<FileType>(FILE_TYPES[0].id);
  const [instructionSet, setInstructionSet] = useState<InstructionSetId>(DEFAULT_INSTRUCTION_SET_ID);
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (res.ok) {
          const data: Project[] = await res.json();
          setProjects(data);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const selectedFileType = useMemo(
    () => FILE_TYPES.find((option) => option.id === fileType) ?? FILE_TYPES[0],
    [fileType]
  );

  const selectedInstructionSet = useMemo(
    () => getInstructionSet(instructionSet),
    [instructionSet]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, fileType, instructionSet, customPrompt })
      });
      if (res.ok) {
        const proj = await res.json();
        setProjects((previousProjects: Project[]) => [proj as Project, ...previousProjects]);
        setName("");
        setDescription("");
        setFileType(FILE_TYPES[0].id);
        setInstructionSet(DEFAULT_INSTRUCTION_SET_ID);
        setCustomPrompt("");
      } else {
        const msg = await res.text();
        setError(msg || "Failed to create project");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Your projects</h1>
          <Link href="/dashboard" className="hidden btn btn-sm btn-secondary lg:inline-flex">Refresh</Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {projects.map((p: Project) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group card cursor-pointer"
            >
              <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-gradient-to-tr from-blue-400/20 via-purple-400/10 to-pink-400/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-300">{p.name}</h2>
                <span className="text-xs text-gray-500">Open →</span>
              </div>
              {p.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{p.description}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                  {FILE_TYPES.find((option) => option.id === p.fileType)?.label ?? p.fileType.toUpperCase()}
                </span>
                <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200">
                  {getInstructionSet(p.instructionSet)?.name ?? "Custom workflow"}
                </span>
                {p.customPrompt ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                    Custom prompt
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
          {projects.length === 0 ? (
            <div className="card flex flex-col items-center justify-center border-dashed p-8 text-center text-sm text-gray-500 dark:border-gray-700">
              <span className="mb-2 text-2xl">🗂️</span>
              No projects yet. Create one to get started.
            </div>
          ) : null}
        </div>
      </div>

      <aside className="space-y-6">
        <div className="card">
          <h2 className="mb-4 text-xl font-semibold">Create a project</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Project name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">File type</label>
              <select className="input" value={fileType} onChange={(e) => setFileType(e.target.value as FileType)}>
                {FILE_TYPES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedFileType.description}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Instruction set</label>
              <select
                className="input"
                value={instructionSet}
                onChange={(e) => setInstructionSet(e.target.value as InstructionSetId)}
              >
                {INSTRUCTION_SETS.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name}
                  </option>
                ))}
              </select>
              {selectedInstructionSet ? (
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  <p className="font-medium text-gray-700 dark:text-gray-200">Workflow preview</p>
                  <ul className="mt-2 space-y-1">
                    {selectedInstructionSet.steps.slice(0, 2).map((step) => (
                      <li key={step} className="flex gap-2">
                        <span className="text-gray-400">•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Custom prompt</label>
              <textarea
                className="input"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Optional instructions to override or extend the selected workflow"
                rows={3}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Provide bespoke guidance if you need the AI to capture project-specific details.
              </p>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? "Creating..." : "Create project"}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

