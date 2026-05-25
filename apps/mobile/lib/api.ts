import Constants from "expo-constants";
import type {
  VideoAnalysis,
  CoachingFeedback,
  ImprovPrompt,
  CoachRequest,
  ImprovRequest,
  AnalyzeVideoRequest,
  CalibrateRequest,
  CalibrateResponse,
  ConverseRequest,
  ConverseResponse,
  JournalChatRequest,
  JournalChatResponse,
} from "@sona/shared";

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const debuggerHost =
    Constants.expoConfig?.hostUri?.split(":").shift() ??
    Constants.expoGoConfig?.debuggerHost?.split(":").shift();
  if (debuggerHost) return `http://${debuggerHost}:8787`;
  return "http://localhost:8787";
}

const BASE_URL = resolveBaseUrl();

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as
    | TRes
    | { error?: string };
  if (!res.ok) {
    const message =
      (data as { error?: string }).error ?? `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data as TRes;
}

async function get<TRes>(path: string): Promise<TRes> {
  const res = await fetch(`${BASE_URL}${path}`);
  const data = (await res.json().catch(() => ({}))) as TRes;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return data as TRes;
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

export const api = {
  baseUrl: BASE_URL,
  analyzeVideo: (req: AnalyzeVideoRequest) =>
    post<AnalyzeVideoRequest, VideoAnalysis>("/api/video/analyze", req),
  coach: (req: CoachRequest) =>
    post<CoachRequest, CoachingFeedback>("/api/coach", req),
  improv: (req: ImprovRequest) =>
    post<ImprovRequest, ImprovPrompt>("/api/improv", req),
  calibrate: (req: CalibrateRequest) =>
    post<CalibrateRequest, CalibrateResponse>("/api/calibrate", req),
  converse: (req: ConverseRequest) =>
    post<ConverseRequest, ConverseResponse>("/api/converse", req),
  journalChat: (req: JournalChatRequest) =>
    post<JournalChatRequest, JournalChatResponse>("/api/journal-chat", req),
  budget: () => get<BudgetStatus>("/api/budget"),
};
