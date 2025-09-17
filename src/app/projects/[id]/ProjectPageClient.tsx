"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useState } from "react";
import type { InstructionSet } from "@/lib/instruction-sets";
import { ProjectFilesPanel } from "./ProjectFilesPanel";
import { ProjectIngestionSettings } from "./ProjectIngestionSettings";
import { ProjectProcessingRunsPanel } from "./ProjectProcessingRunsPanel";

type SectionId = "overview" | "files" | "results";

type ProjectForClient = {
  id: string;
  name: string;
  description: string | null;
  fileType: string;
  instructionSetId: string | null;
  customPrompt: string | null;
  apiIngestionEnabled: boolean;
  apiToken: string | null;
};

type FileTypeInfo = {
  label: string;
  description: string | null;
};

type FilesPanelProps = ComponentProps<typeof ProjectFilesPanel>;
type ProcessingPanelProps = ComponentProps<typeof ProjectProcessingRunsPanel>;

type Props = {
  project: ProjectForClient;
  fileType: FileTypeInfo;
  instructionSet: InstructionSet | null;
  files: FilesPanelProps["initialFiles"];
  processingRuns: ProcessingPanelProps["initialRuns"];
  processingSummary: ProcessingPanelProps["initialSummary"];
};

const NAV_SECTIONS: { id: SectionId; label: string; description: string }[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Project metadata and instruction details"
  },
  {
    id: "files",
    label: "Files & ingestion",
    description: "Manage uploads and API ingestion"
  },
  {
    id: "results",
    label: "Processing results",
    description: "Inspect run history and outputs"
  }
];

export function ProjectPageClient({
  project,
  fileType,
  instructionSet,
  files,
  processingRuns,
  processingSummary
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:space-y-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold heading-gradient">{project.name}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Manage ingestion, uploads, and processing results for this project.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-sm btn-secondary">
          Back
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:w-64">
          <nav
            aria-label="Project sections"
            role="tablist"
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Navigate</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Switch between the main areas of the project workspace.
            </p>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {NAV_SECTIONS.map((section) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    id={`project-section-${section.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`project-panel-${section.id}`}
                    onClick={() => setActiveSection(section.id)}
                    className={`min-w-[220px] rounded-md px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isActive
                        ? "bg-blue-600 text-white shadow dark:bg-blue-500"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span className="font-medium leading-none">{section.label}</span>
                    <span className="mt-1 block text-xs opacity-80">{section.description}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <main className="flex-1">
          {NAV_SECTIONS.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <section
                key={section.id}
                id={`project-panel-${section.id}`}
                role="tabpanel"
                aria-labelledby={`project-section-${section.id}`}
                hidden={!isActive}
                className="space-y-6"
              >
                {section.id === "overview" ? (
                  <OverviewSection project={project} fileType={fileType} instructionSet={instructionSet} />
                ) : null}
                {section.id === "files" ? (
                  <FilesSection
                    projectId={project.id}
                    apiIngestionEnabled={project.apiIngestionEnabled}
                    apiToken={project.apiToken}
                    files={files}
                  />
                ) : null}
                {section.id === "results" ? (
                  <ResultsSection
                    projectId={project.id}
                    runs={processingRuns}
                    summary={processingSummary}
                  />
                ) : null}
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
}

type OverviewProps = {
  project: ProjectForClient;
  fileType: FileTypeInfo;
  instructionSet: InstructionSet | null;
};

function OverviewSection({ project, fileType, instructionSet }: OverviewProps) {
  return (
    <div className="space-y-6">
      <div className="card space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Project ID</p>
            <p className="mt-1 font-mono text-sm text-gray-800 dark:text-gray-200 md:text-base">{project.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">File type</p>
            <p className="mt-1 text-base text-gray-900 dark:text-gray-100">{fileType.label}</p>
            {fileType.description ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{fileType.description}</p>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-gray-500">Instruction set</p>
            <p className="mt-1 text-base text-gray-900 dark:text-gray-100">
              {instructionSet?.name ?? project.instructionSetId ?? "Custom"}
            </p>
            {instructionSet ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{instructionSet.summary}</p>
            ) : null}
          </div>
          <div>
            <p className="text-sm text-gray-500">Description</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {project.description ?? "No description provided."}
            </p>
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
            <div className="mt-3 grid gap-3 md:grid-cols-2">
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

type FilesSectionProps = {
  projectId: string;
  apiIngestionEnabled: boolean;
  apiToken: string | null;
  files: FilesPanelProps["initialFiles"];
};

function FilesSection({ projectId, apiIngestionEnabled, apiToken, files }: FilesSectionProps) {
  return (
    <div className="space-y-6">
      <ProjectIngestionSettings
        projectId={projectId}
        initialEnabled={apiIngestionEnabled}
        initialToken={apiToken}
      />
      <ProjectFilesPanel projectId={projectId} initialFiles={files} />
    </div>
  );
}

type ResultsSectionProps = {
  projectId: string;
  runs: ProcessingPanelProps["initialRuns"];
  summary: ProcessingPanelProps["initialSummary"];
};

function ResultsSection({ projectId, runs, summary }: ResultsSectionProps) {
  return (
    <div className="space-y-6">
      <ProjectProcessingRunsPanel projectId={projectId} initialRuns={runs} initialSummary={summary} />
    </div>
  );
}
