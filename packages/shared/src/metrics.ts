import type { ProsodyMetrics, SpeechMetrics } from "./types";

const FILLER_PATTERNS = [
  "um",
  "uh",
  "uhh",
  "umm",
  "like",
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "basically",
  "literally",
  "right",
  "okay so",
];

export interface MetricsInput {
  transcript: string;
  durationSeconds: number;
  pauseSegments?: Array<{ startSec: number; endSec: number }>;
  prosody?: ProsodyMetrics;
}

export function computeMetrics(input: MetricsInput): SpeechMetrics {
  const { transcript, durationSeconds, pauseSegments = [], prosody } = input;
  const normalized = transcript.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const minutes = Math.max(durationSeconds, 1) / 60;
  const wpm = Math.round(wordCount / minutes);

  const fillerWords: string[] = [];
  for (const filler of FILLER_PATTERNS) {
    const re = new RegExp(`\\b${filler.replace(/ /g, "\\s+")}\\b`, "gi");
    const matches = transcript.match(re);
    if (matches) {
      for (const m of matches) fillerWords.push(m.toLowerCase());
    }
  }

  const pauseDurations = pauseSegments.map((p) => p.endSec - p.startSec);
  const longestPause = pauseDurations.length ? Math.max(...pauseDurations) : 0;
  const totalPause = pauseDurations.reduce((a, b) => a + b, 0);
  const pauseRatio =
    durationSeconds > 0 ? Math.min(1, totalPause / durationSeconds) : 0;

  return {
    durationSeconds: Math.round(durationSeconds * 10) / 10,
    wordCount,
    wordsPerMinute: wpm,
    fillerCount: fillerWords.length,
    fillerWords,
    longestPauseSeconds: Math.round(longestPause * 10) / 10,
    pauseRatio: Math.round(pauseRatio * 100) / 100,
    prosody,
  };
}
