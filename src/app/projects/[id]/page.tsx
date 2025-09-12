import Link from "next/link";

async function fetchProject(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/projects/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const project = await fetchProject(id);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project?.name ?? "Project"}</h1>
        <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-sm text-gray-900 transition hover:bg-gray-100 dark:border-gray-800 dark:bg-black/60 dark:text-gray-200 dark:hover:bg-black">Back</Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/70 p-6 shadow-sm dark:border-gray-800 dark:bg-black/50">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Project ID</p>
            <p className="font-mono text-lg">{id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Name</p>
            <p className="text-lg">{project?.name ?? "—"}</p>
          </div>
        </div>
        {project?.description ? (
          <div className="mt-6">
            <p className="text-sm text-gray-500">Description</p>
            <p className="text-gray-700 dark:text-gray-300">{project.description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

