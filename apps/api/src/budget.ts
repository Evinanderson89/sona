import fs from "node:fs";
import path from "node:path";

// Claude Sonnet 4.6 pricing (USD per million tokens).
// Override via SONNET_INPUT_PER_M / SONNET_OUTPUT_PER_M if Anthropic changes them.
const INPUT_PER_M = Number(process.env.SONNET_INPUT_PER_M ?? 3);
const OUTPUT_PER_M = Number(process.env.SONNET_OUTPUT_PER_M ?? 15);

export const BUDGET_CAP_USD = Number(process.env.BUDGET_CAP_USD ?? 25);

const USAGE_FILE = path.resolve(process.cwd(), ".usage.json");

interface Usage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  firstRequestAt: string;
  lastRequestAt: string;
  callCount: number;
  blockedCount: number;
}

function emptyUsage(): Usage {
  const now = new Date().toISOString();
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    firstRequestAt: now,
    lastRequestAt: now,
    callCount: 0,
    blockedCount: 0,
  };
}

function load(): Usage {
  if (!fs.existsSync(USAGE_FILE)) return emptyUsage();
  try {
    const parsed = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
    return { ...emptyUsage(), ...parsed };
  } catch {
    return emptyUsage();
  }
}

function save(u: Usage): void {
  fs.writeFileSync(USAGE_FILE, JSON.stringify(u, null, 2));
}

export interface BudgetStatus {
  cap: number;
  spent: number;
  remaining: number;
  ok: boolean;
  callCount: number;
  blockedCount: number;
  firstRequestAt: string;
  lastRequestAt: string;
}

export function getStatus(): BudgetStatus {
  const u = load();
  const remaining = Math.max(0, BUDGET_CAP_USD - u.totalCostUsd);
  return {
    cap: BUDGET_CAP_USD,
    spent: round(u.totalCostUsd),
    remaining: round(remaining),
    ok: remaining > 0,
    callCount: u.callCount,
    blockedCount: u.blockedCount,
    firstRequestAt: u.firstRequestAt,
    lastRequestAt: u.lastRequestAt,
  };
}

export class BudgetExceededError extends Error {
  status: BudgetStatus;
  constructor(status: BudgetStatus) {
    super(
      `Spending cap of $${status.cap.toFixed(2)} reached ($${status.spent.toFixed(2)} spent). Raise BUDGET_CAP_USD or reset .usage.json.`,
    );
    this.name = "BudgetExceededError";
    this.status = status;
  }
}

export function checkBudgetOrThrow(): void {
  const status = getStatus();
  if (!status.ok) {
    recordBlocked();
    throw new BudgetExceededError(status);
  }
}

export function recordUsage(
  inputTokens: number,
  outputTokens: number,
): BudgetStatus {
  const u = load();
  const cost =
    (inputTokens / 1_000_000) * INPUT_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_PER_M;
  const next: Usage = {
    ...u,
    totalInputTokens: u.totalInputTokens + inputTokens,
    totalOutputTokens: u.totalOutputTokens + outputTokens,
    totalCostUsd: u.totalCostUsd + cost,
    callCount: u.callCount + 1,
    lastRequestAt: new Date().toISOString(),
  };
  if (next.callCount === 1) next.firstRequestAt = next.lastRequestAt;
  save(next);
  return getStatus();
}

function recordBlocked(): void {
  const u = load();
  u.blockedCount += 1;
  save(u);
}

function round(n: number) {
  return Math.round(n * 10000) / 10000;
}
