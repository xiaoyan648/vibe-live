import { generateArtworkForVibe } from "./artwork";
import { generateVibeFromPrompt, type GenerationStage } from "./generate";
import type { AiRequestConfig } from "./client";
import type { Vibe } from "@/data/vibes";

export type GenerationJobStatus = "queued" | "running" | "music_ready" | "completed" | "failed";

export interface GenerationJobLog {
  id: string;
  label: string;
  status: "pending" | "completed" | "repaired" | "fallback" | "error";
  at: string;
  message?: string;
}

export interface GenerationJobSnapshot {
  id: string;
  prompt: string;
  status: GenerationJobStatus;
  logs: GenerationJobLog[];
  stages: GenerationStage[];
  startedAt: string;
  updatedAt: string;
  error?: string;
  vibe?: Vibe;
  repaired?: boolean;
  fallback?: boolean;
}

interface GenerationJobRecord extends GenerationJobSnapshot {
  promise?: Promise<void>;
  aiConfig?: AiRequestConfig;
}

const JOB_TTL_MS = 1000 * 60 * 60;

type JobGlobal = typeof globalThis & {
  __vibeliveGenerationJobs?: Map<string, GenerationJobRecord>;
};

const jobs = ((globalThis as JobGlobal).__vibeliveGenerationJobs ??= new Map<string, GenerationJobRecord>());

function nowIso() {
  return new Date().toISOString();
}

function createJobId() {
  return `job-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

function pruneJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - Date.parse(job.updatedAt) > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

function toLog(stage: GenerationStage): GenerationJobLog {
  return {
    id: `${stage.id}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`,
    label: stage.label,
    status: stage.status,
    at: nowIso(),
  };
}

function snapshot(job: GenerationJobRecord): GenerationJobSnapshot {
  const { promise: _promise, aiConfig: _aiConfig, ...publicJob } = job;
  return publicJob;
}

function updateJob(id: string, patch: Partial<GenerationJobRecord>) {
  const job = jobs.get(id);
  if (!job) return;
  jobs.set(id, {
    ...job,
    ...patch,
    updatedAt: nowIso(),
  });
}

async function runJob(id: string) {
  const job = jobs.get(id);
  if (!job) return;

  try {
    updateJob(id, {
      status: "running",
      logs: [
        ...job.logs,
        { id: "accepted", label: "刻录请求已接收", status: "completed", at: nowIso() },
      ],
    });

    const result = await generateVibeFromPrompt(job.prompt, {
      aiConfig: job.aiConfig,
      onStage(stage) {
        const current = jobs.get(id);
        if (!current) return;
        updateJob(id, {
          stages: [...current.stages, stage],
          logs: [...current.logs, toLog(stage)],
        });
      },
    });

    updateJob(id, {
      status: "music_ready",
      vibe: result.vibe,
      repaired: result.repaired,
      fallback: result.fallback,
      logs: [
        ...(jobs.get(id)?.logs ?? []),
        { id: "music-ready", label: "音乐已刻录", status: "completed", at: nowIso() },
        { id: "artwork-start", label: "正在生成视觉母图", status: "pending", at: nowIso() },
      ],
    });

    try {
      const artwork = await generateArtworkForVibe(result.vibe, job.prompt, job.aiConfig);
      updateJob(id, {
        status: "completed",
        vibe: { ...result.vibe, artwork },
        logs: [
          ...(jobs.get(id)?.logs ?? []),
          { id: "artwork-done", label: "视觉母图已生成", status: "completed", at: nowIso() },
        ],
      });
    } catch (error) {
      updateJob(id, {
        status: "completed",
        logs: [
          ...(jobs.get(id)?.logs ?? []),
          {
            id: "artwork-error",
            label: "视觉母图生成失败",
            status: "error",
            at: nowIso(),
            message: error instanceof Error ? error.message : "封面生成失败。",
          },
        ],
      });
    }
  } catch (error) {
    updateJob(id, {
      status: "failed",
      error: error instanceof Error ? error.message : "生成失败，请稍后再试。",
      logs: [
        ...(jobs.get(id)?.logs ?? []),
        {
          id: "failed",
          label: "刻录失败",
          status: "error",
          at: nowIso(),
          message: error instanceof Error ? error.message : "生成失败，请稍后再试。",
        },
      ],
    });
  }
}

export function createGenerationJob(prompt: string, options?: { aiConfig?: AiRequestConfig }) {
  pruneJobs();
  const id = createJobId();
  const job: GenerationJobRecord = {
    id,
    prompt,
    status: "queued",
    logs: [{ id: "start", label: "准备空白唱片", status: "pending", at: nowIso() }],
    stages: [],
    startedAt: nowIso(),
    updatedAt: nowIso(),
    aiConfig: options?.aiConfig,
  };
  jobs.set(id, job);
  job.promise = runJob(id);
  return snapshot(job);
}

export function getGenerationJob(id: string) {
  pruneJobs();
  const job = jobs.get(id);
  return job ? snapshot(job) : null;
}
