"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  description?: string;
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description })
      });
      if (res.ok) {
        const proj = await res.json();
        setProjects((previousProjects: Project[]) => [proj as Project, ...previousProjects]);
        setName("");
        setDescription("");
      } else {
        const msg = await res.text();
        setError(msg || "Failed to create project");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your projects</h1>
          <Link href="/dashboard" className="hidden rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-sm text-gray-900 transition hover:bg-gray-100 dark:border-gray-800 dark:bg-black/60 dark:text-gray-100 dark:hover:bg-black lg:inline-flex">Refresh</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p: Project) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-black/50"
            >
              <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-gradient-to-tr from-blue-400/20 via-purple-400/10 to-pink-400/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-300">{p.name}</h2>
                <span className="text-xs text-gray-500">Open →</span>
              </div>
              {p.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{p.description}</p>
              ) : null}
            </Link>
          ))}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
              <span className="mb-2 text-2xl">🗂️</span>
              No projects yet. Create one to get started.
            </div>
          ) : null}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm dark:border-gray-800 dark:bg-black/50">
          <h2 className="mb-3 text-xl font-semibold">Create a project</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                className="block w-full rounded-lg border-gray-300 bg-white px-3.5 py-2.5 shadow-sm outline-none ring-0 transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-black dark:placeholder:text-gray-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Project name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                className="block w-full rounded-lg border-gray-300 bg-white px-3.5 py-2.5 shadow-sm outline-none ring-0 transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-black dark:placeholder:text-gray-500"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 font-medium text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create project"}
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}

