import { NextRequest } from "next/server";

import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/auth";
import { listRunsForProject } from "@/lib/processing-service";

const ACTIVE_STATUSES = new Set(["pending", "running"]);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const db = getDb() as any;
  const project = await db
    .selectFrom("project")
    .select(["id", "ownerId"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!project || project.ownerId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.max(1, Math.min(Number.parseInt(limitParam ?? "20", 10) || 20, 100));
  const runs = await listRunsForProject(id, limit);

  const summary = runs.reduce(
    (acc, run) => {
      if (typeof run.usageSummary?.totalTokens === "number") {
        acc.totalTokens += run.usageSummary.totalTokens;
      }
      if (typeof run.usageSummary?.totalCostUsd === "number") {
        acc.totalCostUsd += run.usageSummary.totalCostUsd;
      }
      if (ACTIVE_STATUSES.has(run.status)) {
        acc.active += 1;
      }
      return acc;
    },
    { totalTokens: 0, totalCostUsd: 0, active: 0 }
  );

  return Response.json({ runs, summary });
}
