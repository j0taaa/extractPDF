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
        setProjects((prev) => [proj, ...prev]);
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
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-semibold">Your projects</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="rounded-lg border p-4 hover:shadow transition">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">{p.name}</h2>
                <span className="text-xs text-gray-500">Open</span>
              </div>
              {p.description ? (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{p.description}</p>
              ) : null}
            </Link>
          ))}
          {projects.length === 0 ? (
            <div className="text-sm text-gray-500">No projects yet. Create one to get started.</div>
          ) : null}
        </div>
      </div>

      <aside className="space-y-4">
        <h2 className="text-xl font-medium">Create a project</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              className="block w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Project name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="block w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-black px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50 w-full"
          >
            {loading ? "Creating..." : "Create project"}
          </button>
        </form>
      </aside>
    </div>
  );
}

