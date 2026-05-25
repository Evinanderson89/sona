import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, HAIKU_MODEL } from "@sona/shared";
import { checkBudgetOrThrow, recordUsage } from "./budget.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Copy .env.example to apps/api/.env and fill it in.",
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface JsonCallOptions {
  system: string;
  user: string;
  maxTokens?: number;
  model?: "sonnet" | "haiku";
}

export async function callClaudeJson<T>(opts: JsonCallOptions): Promise<T> {
  const raw = await callClaudeRaw({ ...opts, expectJson: true });
  const jsonText = extractJson(raw);
  try {
    return JSON.parse(jsonText) as T;
  } catch (err) {
    throw new Error(
      `Claude returned invalid JSON: ${(err as Error).message}\n---\n${raw}`,
    );
  }
}

export async function callClaudeText(opts: JsonCallOptions): Promise<string> {
  return callClaudeRaw({ ...opts, expectJson: false });
}

async function callClaudeRaw(
  opts: JsonCallOptions & { expectJson: boolean },
): Promise<string> {
  checkBudgetOrThrow();
  const anthropic = getClient();
  const model = opts.model === "haiku" ? HAIKU_MODEL : CLAUDE_MODEL;
  const response = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  if (response.usage) {
    recordUsage(response.usage.input_tokens, response.usage.output_tokens);
  }
  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }
  return textBlock.text.trim();
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return text.slice(first, last + 1);
  }
  return text;
}
