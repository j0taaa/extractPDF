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

