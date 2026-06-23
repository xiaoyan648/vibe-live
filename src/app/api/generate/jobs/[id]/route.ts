import { getGenerationJob } from "@/ai/generationJobs";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = getGenerationJob(id);

  if (!job) {
    return Response.json({ error: "刻录任务不存在或已过期。" }, { status: 404 });
  }

  return Response.json({ job });
}
