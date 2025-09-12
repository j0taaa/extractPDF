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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project?.name ?? "Project"}</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">Back to dashboard</Link>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-sm text-gray-500">Project ID</p>
        <p className="text-lg font-mono">{id}</p>
        {project?.description ? (
          <div className="mt-4">
            <p className="text-sm text-gray-500">Description</p>
            <p>{project.description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

