import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";
import { FILE_TYPES, getInstructionSet } from "@/lib/instruction-sets";
import { listRunsForProject } from "@/lib/processing-service";
import { ProjectFilesPanel } from "./ProjectFilesPanel";
import { ProjectIngestionSettings } from "./ProjectIngestionSettings";
import { ProjectProcessingRunsPanel } from "./ProjectProcessingRunsPanel";

type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  fileType: string;
  instructionSet: string | null;
  customPrompt: string | null;
  apiIngestionEnabled: boolean;
  apiToken: string | null;
};

type ProjectFileRecord = {
  id: string;
  originalName: string;
  size: string | number;
  contentType: string | null;
  uploadedViaApi: boolean;
  createdAt: Date | string;
};

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold heading-gradient">Project</h1>
          <Link href="/login" className="btn btn-sm btn-primary">
            Sign in
          </Link>
        </div>
        <div className="card space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>You need to sign in to view this project.</p>
          <p>
            Once you sign in, return to the
            <Link href="/dashboard" className="text-blue-600 hover:underline dark:text-blue-300">
              {" "}
              dashboard
            </Link>
            to browse your projects.
          </p>
        </div>
      </div>
    );
  }

  const db = getDb() as any;
  const project = (await db
    .selectFrom("project")
    .select([
      "id",
      "name",
      "description",
      "fileType",
      "instructionSet",
      "customPrompt",
      "apiIngestionEnabled",
      "apiToken"
    ])
    .where("id", "=", id)
    .where("ownerId", "=", userId)
    .executeTakeFirst()) as ProjectRecord | undefined;

  if (!project) {
    notFound();
  }

  const fileType = FILE_TYPES.find((type) => type.id === project.fileType);
  const instructionSet = getInstructionSet(project.instructionSet);
  const projectFiles = (await db
    .selectFrom("projectFile")
    .select(["id", "originalName", "size", "contentType", "uploadedViaApi", "createdAt"])
    .where("projectId", "=", project.id)
    .orderBy("createdAt", "desc")
    .execute()) as ProjectFileRecord[];

  const files = projectFiles.map((file) => {
    const rawSize = typeof file.size === "string" ? Number(file.size) : file.size;
    const normalizedSize = Number.isFinite(rawSize) ? rawSize : 0;
    const timestamp =
      file.createdAt instanceof Date
        ? file.createdAt.toISOString()
        : new Date(file.createdAt).toISOString();

    return {
      id: file.id,
      originalName: file.originalName,
      size: normalizedSize,
      contentType: file.contentType,
      uploadedViaApi: file.uploadedViaApi,
      createdAt: timestamp
    };
  });

  const processingRuns = await listRunsForProject(project.id, 20);
  const processingSummary = processingRuns.reduce(
    (acc, run) => {
      if (typeof run.usageSummary?.totalTokens === "number") {
        acc.totalTokens += run.usageSummary.totalTokens;
      }
      if (typeof run.usageSummary?.totalCostUsd === "number") {
        acc.totalCostUsd += run.usageSummary.totalCostUsd;
      }
      if (run.status === "pending" || run.status === "running") {
        acc.active += 1;
      }
      return acc;
    },
    { totalTokens: 0, totalCostUsd: 0, active: 0 }
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold heading-gradient">{project.name}</h1>
        <Link href="/dashboard" className="btn btn-sm btn-secondary">
          Back
        </Link>
      </div>

      <div className="card space-y-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Project ID</p>
            <p className="font-mono text-lg">{project.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">File type</p>
            <p className="text-lg">{fileType?.label ?? project.fileType}</p>
            {fileType ? <p className="mt-1 text-xs text-gray-500">{fileType.description}</p> : null}
          </div>
          <div>
            <p className="text-sm text-gray-500">Instruction set</p>
            <p className="text-lg">{instructionSet?.name ?? project.instructionSet ?? "Custom"}</p>
            {instructionSet ? <p className="mt-1 text-xs text-gray-500">{instructionSet.summary}</p> : null}
          </div>
          <div>
            <p className="text-sm text-gray-500">Description</p>
            <p className="text-gray-700 dark:text-gray-300">{project.description ?? "No description provided."}</p>
          </div>
        </div>

        {project.customPrompt ? (
          <div>
            <p className="text-sm text-gray-500">Custom prompt</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-100 p-4 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {project.customPrompt}
            </pre>
          </div>
        ) : null}
      </div>

      <ProjectIngestionSettings
        projectId={project.id}
        initialEnabled={project.apiIngestionEnabled}
        initialToken={project.apiToken}
      />

      <ProjectFilesPanel projectId={project.id} initialFiles={files} />

      <ProjectProcessingRunsPanel
        projectId={project.id}
        initialRuns={processingRuns}
        initialSummary={processingSummary}
      />

      {instructionSet ? (
        <div className="card space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Instruction set overview</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{instructionSet.summary}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Processing steps</h3>
            <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {instructionSet.steps.map((step) => (
                <li key={step} className="flex gap-2">
                  <span className="mt-1 text-gray-400">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Outputs</h3>
            <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {instructionSet.outputs.map((output) => (
                <li key={output} className="flex gap-2">
                  <span className="mt-1 text-gray-400">•</span>
                  <span>{output}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Field schema</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {instructionSet.fields.map((field) => (
                <div key={field.name} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{field.name}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{field.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

