export type StyleKey = "funny" | "interesting" | "vivid" | "warm";

export interface StyleDescription {
  style: StyleKey;
  label: string;
  description: string;
}

export interface VideoAnalysis {
  videoId: string;
  url: string;
  title: string;
  channel?: string;
  durationSeconds?: number;
  summary: string;
  transcriptExcerpt: string;
  styles: StyleDescription[];
}

export interface SpeechMetrics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerCount: number;
  fillerWords: string[];
  longestPauseSeconds: number;
  pauseRatio: number;
  prosody?: ProsodyMetrics;
}

export interface ProsodyMetrics {
  // Pitch (Hz). Null/undefined if not measured (e.g. native recording).
  pitchMedianHz: number;
  pitchMinHz: number;
  pitchMaxHz: number;
  pitchRangeSemitones: number;
  // Coefficient of variation of pitch — higher = more expressive, lower = monotone.
  pitchVariation: number;
  // End-of-phrase contour: +1 = rising (questions), -1 = falling, 0 = flat.
  endingContour: number;
  // Loudness (RMS, 0-1) summary.
  loudnessMedian: number;
  loudnessMin: number;
  loudnessMax: number;
  // 0-1; how much loudness varies across the take.
  loudnessDynamics: number;
  // How many samples we collected (sanity).
  voicedFrames: number;
  totalFrames: number;
}

export interface CoachingFeedback {
  overall: string;
  strengths: string[];
  growthEdges: string[];
  vividnessScore: number;
  warmthScore: number;
  engagementScore: number;
  rewrite: string;
  rewriteNotes: string;
}

export interface JournalEntry {
  id: string;
  createdAt: string;
  video: Pick<VideoAnalysis, "videoId" | "url" | "title">;
  improvConstraint?: string;
  userTranscript: string;
  metrics: SpeechMetrics;
  feedback: CoachingFeedback;
}

export interface ImprovPrompt {
  constraint: string;
  rationale: string;
}

export interface AnalyzeVideoRequest {
  url: string;
}

export interface CoachRequest {
  videoContext: {
    title: string;
    summary: string;
    transcriptExcerpt: string;
  };
  userTranscript: string;
  metrics: SpeechMetrics;
  improvConstraint?: string;
}

export interface ImprovRequest {
  videoTitle?: string;
  recentConstraints?: string[];
}

export interface BaselineMetrics {
  pitchMedianHz: number;
  pitchRangeSemitones: number;
  pitchVariation: number;
  loudnessDynamics: number;
  wordsPerMinute: number;
  fillerRate: number; // fillers per minute
}

export interface UserProfile {
  version: number; // bumps on each (re)calibration
  archetypeName: string; // e.g. "The Warm Catalyst"
  archetypeDescription: string;
  growthEdges: string[];
  baseline: BaselineMetrics;
  takesSinceCalibration: number; // drift counter
  lastCalibratedAt: string;
  history: Array<{
    version: number;
    archetypeName: string;
    baseline: BaselineMetrics;
    createdAt: string;
  }>;
}

export interface CalibrateRequest {
  transcript: string;
  metrics: SpeechMetrics;
  previousArchetype?: string;
}

export interface CalibrateResponse {
  archetypeName: string;
  archetypeDescription: string;
  growthEdges: string[];
}

export interface DailyMission {
  date: string; // YYYY-MM-DD
  videoUrl: string;
  videoTitle: string;
  duration: string;
  cue: string;
  cueRationale: string;
}

export type BreakthroughType =
  | "pacing"
  | "range"
  | "variation"
  | "warmth"
  | "fillers"
  | "dynamics";

export interface Breakthrough {
  takeId: string;
  type: BreakthroughType;
  title: string;
  detail: string;
  createdAt: string;
}

export type ConversationTheme = "interview" | "story" | "reflection" | "debate";

export interface ConversationTurnRating {
  presence: number;
  specificity: number;
  depth: number;
  listenability: number;
  note: string;
}

export interface ConversationTurn {
  question: string;
  userTranscript: string;
  metrics: SpeechMetrics;
  rating: ConversationTurnRating;
  askedAt: string;
  answeredAt: string;
}

export interface ConversationSummary {
  overall: string;
  strengths: string[];
  growthEdges: string[];
  averageScore: number;
}

export interface ConversationSession {
  id: string;
  createdAt: string;
  theme: ConversationTheme;
  themeLabel: string;
  turns: ConversationTurn[];
  finalSummary?: ConversationSummary;
}

export interface ConverseRequest {
  theme: ConversationTheme;
  archetypeName?: string;
  archetypeContext?: string;
  growthEdges?: string[];
  history: Array<{
    question: string;
    userTranscript: string;
    metrics?: SpeechMetrics;
    rating?: ConversationTurnRating;
  }>;
  current?: {
    question: string;
    userTranscript: string;
    metrics: SpeechMetrics;
  };
  maxTurns: number;
}

export interface ConverseResponse {
  rating?: ConversationTurnRating;
  nextQuestion?: string;
  finalSummary?: ConversationSummary;
}

export interface JournalChatTakeSummary {
  createdAt: string;
  videoTitle: string;
  transcriptExcerpt: string;
  vividness: number;
  warmth: number;
  engagement: number;
  wordsPerMinute: number;
  pitchRangeSemitones?: number;
}

export interface JournalChatRequest {
  question: string;
  archetypeName?: string;
  archetypeContext?: string;
  growthEdges?: string[];
  baseline?: BaselineMetrics;
  recentTakes: JournalChatTakeSummary[];
  recentBreakthroughs: Breakthrough[];
}

export interface JournalChatResponse {
  answer: string;
}
