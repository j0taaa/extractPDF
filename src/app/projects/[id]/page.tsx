import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";
import { FILE_TYPES, getInstructionSet } from "@/lib/instruction-sets";
import { getProcessingProgress, listRunsForProject } from "@/lib/processing-service";
import { ProjectPageClient } from "./ProjectPageClient";

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

  const fileTypeLabel = fileType?.label ?? project.fileType;
  const fileTypeDescription = fileType?.description ?? null;

  const processingProgress = await getProcessingProgress(project.id);

  return (
    <ProjectPageClient
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        fileType: project.fileType,
        instructionSetId: project.instructionSet,
        customPrompt: project.customPrompt,
        apiIngestionEnabled: project.apiIngestionEnabled,
        apiToken: project.apiToken
      }}
      fileType={{
        label: fileTypeLabel,
        description: fileTypeDescription
      }}
      instructionSet={instructionSet}
      files={files}
      processingRuns={processingRuns}
      processingSummary={processingSummary}
      processingProgress={processingProgress}
    />
  );
}

