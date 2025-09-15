import Link from "next/link";
import { headers } from "next/headers";

async function resolveBaseUrl(): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  const headersList = await headers();
  const host = headersList.get("host");
  if (!host) {
    return null;
  }

  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

async function fetchProject(baseUrl: string, id: string) {
  try {
    const url = new URL(`/api/projects/${id}`, baseUrl);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    console.error(`Failed to fetch project ${id}`, error);
    return null;
  }
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const baseUrl = await resolveBaseUrl();
  const project = baseUrl ? await fetchProject(baseUrl, id) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold heading-gradient">{project?.name ?? "Project"}</h1>
        <Link href="/dashboard" className="btn btn-sm btn-secondary">Back</Link>
      </div>

      <div className="card">
        <div className="grid gap-8 sm:grid-cols-2">
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
          <div className="mt-8">
            <p className="text-sm text-gray-500">Description</p>
            <p className="text-gray-700 dark:text-gray-300">{project.description}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

