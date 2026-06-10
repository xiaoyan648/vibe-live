import type { ResponseFormatJSONSchema } from "openai/resources/shared";

export interface AgentStage {
  id: string;
  label: string;
  status: "completed" | "repaired" | "fallback";
}

export interface AgentStep<Input, Output> {
  id: string;
  label: string;
  system: string;
  jsonSchema: ResponseFormatJSONSchema.JSONSchema;
  temperature: number;
  maxTokens: number;
  buildUserPrompt: (input: Input) => string;
  parse: (rawJson: unknown) => Output;
}

export interface AgentModelRequest {
  system: string;
  user: string;
  jsonSchema: ResponseFormatJSONSchema.JSONSchema;
  temperature: number;
  maxTokens: number;
}

export interface AgentStepResult<Output> {
  output: Output;
  rawOutput: string;
  stage: AgentStage;
}

export function extractJson(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced?.[1]?.trim() ?? trimmed;
}

export function parseModelJson(content: string) {
  return JSON.parse(extractJson(content)) as unknown;
}

export async function runAgentStep<Input, Output>(
  step: AgentStep<Input, Output>,
  input: Input,
  request: (request: AgentModelRequest) => Promise<string>,
): Promise<AgentStepResult<Output>> {
  const rawOutput = await request({
    system: step.system,
    user: step.buildUserPrompt(input),
    jsonSchema: step.jsonSchema,
    temperature: step.temperature,
    maxTokens: step.maxTokens,
  });

  return {
    output: step.parse(parseModelJson(rawOutput)),
    rawOutput,
    stage: { id: step.id, label: step.label, status: "completed" },
  };
}
