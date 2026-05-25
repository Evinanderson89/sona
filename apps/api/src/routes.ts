import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import {
  VIDEO_ANALYSIS_SYSTEM,
  COACH_SYSTEM,
  IMPROV_SYSTEM,
  CALIBRATE_SYSTEM,
  CONVERSATION_SYSTEM,
  JOURNAL_BOT_SYSTEM,
  type VideoAnalysis,
  type CoachingFeedback,
  type ImprovPrompt,
  type StyleDescription,
  type CalibrateResponse,
  type ConverseResponse,
} from "@sona/shared";
import { callClaudeJson, callClaudeText } from "./anthropic.js";
import { fetchVideo, truncateForPrompt } from "./youtube.js";
import { BudgetExceededError, getStatus as getBudget } from "./budget.js";

const app = new Hono();

// Middleware MUST be registered before routes — otherwise routes that match
// first short-circuit the request and the middleware never runs.
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/budget", (c) => c.json(getBudget()));

const journalChatSchema = z.object({
  question: z.string().min(1).max(500),
  archetypeName: z.string().optional(),
  archetypeContext: z.string().optional(),
  growthEdges: z.array(z.string()).optional(),
  baseline: z
    .object({
      pitchMedianHz: z.number(),
      pitchRangeSemitones: z.number(),
      pitchVariation: z.number(),
      loudnessDynamics: z.number(),
      wordsPerMinute: z.number(),
      fillerRate: z.number(),
    })
    .optional(),
  recentTakes: z.array(
    z.object({
      createdAt: z.string(),
      videoTitle: z.string(),
      transcriptExcerpt: z.string(),
      vividness: z.number(),
      warmth: z.number(),
      engagement: z.number(),
      wordsPerMinute: z.number(),
      pitchRangeSemitones: z.number().optional(),
    }),
  ),
  recentBreakthroughs: z.array(
    z.object({
      takeId: z.string(),
      type: z.string(),
      title: z.string(),
      detail: z.string(),
      createdAt: z.string(),
    }),
  ),
});

app.post("/api/journal-chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = journalChatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request" }, 400);
  }
  try {
    const d = parsed.data;
    const ctx: string[] = [];
    if (d.archetypeName) ctx.push(`Archetype: ${d.archetypeName}`);
    if (d.archetypeContext) ctx.push(`Archetype context: ${d.archetypeContext}`);
    if (d.growthEdges?.length)
      ctx.push(`Growth edges:\n- ${d.growthEdges.join("\n- ")}`);
    if (d.baseline)
      ctx.push(
        `Baseline: ${d.baseline.wordsPerMinute} wpm · pitch range ${d.baseline.pitchRangeSemitones} st · variation ${d.baseline.pitchVariation} · fillers/min ${d.baseline.fillerRate.toFixed(1)} · dynamics ${d.baseline.loudnessDynamics}`,
      );

    if (d.recentTakes.length) {
      ctx.push("\nRecent takes (most recent first):");
      d.recentTakes.forEach((t, i) => {
        ctx.push(
          `${i + 1}. [${shortDate(t.createdAt)}] "${t.videoTitle}" — V${t.vividness}/W${t.warmth}/E${t.engagement} · ${t.wordsPerMinute} wpm${t.pitchRangeSemitones !== undefined ? ` · range ${t.pitchRangeSemitones} st` : ""}`,
        );
        ctx.push(`   said: "${truncate(t.transcriptExcerpt, 200)}"`);
      });
    } else {
      ctx.push("No takes recorded yet.");
    }

    if (d.recentBreakthroughs.length) {
      ctx.push("\nRecent breakthroughs:");
      d.recentBreakthroughs.forEach((b) => {
        ctx.push(
          `- [${shortDate(b.createdAt)}] ${b.title}: ${b.detail}`,
        );
      });
    }

    ctx.push(`\nUSER QUESTION:\n${d.question}`);

    const answer = await callClaudeText({
      system: JOURNAL_BOT_SYSTEM,
      user: ctx.join("\n"),
      maxTokens: 350,
      model: "haiku",
    });
    return c.json({ answer });
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err;
    return c.json({ error: (err as Error).message }, 500);
  }
});

function shortDate(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "1d ago";
  if (diff < 7) return `${diff}d ago`;
  return `${Math.floor(diff / 7)}w ago`;
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

const analyzeSchema = z.object({ url: z.string().url() });

app.post("/api/video/analyze", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request: needs { url }" }, 400);
  }

  try {
    const video = await fetchVideo(parsed.data.url);
    const excerpt = truncateForPrompt(video.transcript);

    const userPrompt = [
      `Title: ${video.title}`,
      video.channel ? `Channel: ${video.channel}` : null,
      video.durationSeconds
        ? `Duration: ${video.durationSeconds}s`
        : null,
      "",
      "Transcript excerpt:",
      excerpt || "(no captions available — describe based on the title alone, and note the constraint in each style)",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await callClaudeJson<{
      summary: string;
      styles: StyleDescription[];
    }>({
      system: VIDEO_ANALYSIS_SYSTEM,
      user: userPrompt,
      maxTokens: 1200,
    });

    const analysis: VideoAnalysis = {
      videoId: video.videoId,
      url: parsed.data.url,
      title: video.title,
      channel: video.channel,
      durationSeconds: video.durationSeconds,
      summary: result.summary,
      transcriptExcerpt: excerpt,
      styles: result.styles,
    };

    return c.json(analysis);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

const prosodySchema = z.object({
  pitchMedianHz: z.number(),
  pitchMinHz: z.number(),
  pitchMaxHz: z.number(),
  pitchRangeSemitones: z.number(),
  pitchVariation: z.number(),
  endingContour: z.number(),
  loudnessMedian: z.number(),
  loudnessMin: z.number(),
  loudnessMax: z.number(),
  loudnessDynamics: z.number(),
  voicedFrames: z.number(),
  totalFrames: z.number(),
});

const coachSchema = z.object({
  videoContext: z.object({
    title: z.string(),
    summary: z.string(),
    transcriptExcerpt: z.string(),
  }),
  userTranscript: z.string().min(1),
  metrics: z.object({
    durationSeconds: z.number(),
    wordCount: z.number(),
    wordsPerMinute: z.number(),
    fillerCount: z.number(),
    fillerWords: z.array(z.string()),
    longestPauseSeconds: z.number(),
    pauseRatio: z.number(),
    prosody: prosodySchema.optional(),
  }),
  improvConstraint: z.string().optional(),
});

app.post("/api/coach", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = coachSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", issues: parsed.error.issues },
      400,
    );
  }

  try {
    const { videoContext, userTranscript, metrics, improvConstraint } =
      parsed.data;
    const userPrompt = [
      `Video title: ${videoContext.title}`,
      `Neutral summary: ${videoContext.summary}`,
      "",
      "Video transcript excerpt:",
      truncateForPrompt(videoContext.transcriptExcerpt, 2500),
      "",
      improvConstraint
        ? `Improv constraint they were honoring: ${improvConstraint}`
        : "",
      "",
      "User's spoken transcript:",
      userTranscript,
      "",
      "Audio metrics (computed locally):",
      `- Duration: ${metrics.durationSeconds}s`,
      `- Words: ${metrics.wordCount} (${metrics.wordsPerMinute} wpm)`,
      `- Filler words: ${metrics.fillerCount}${
        metrics.fillerWords.length ? ` — ${metrics.fillerWords.join(", ")}` : ""
      }`,
      `- Longest pause: ${metrics.longestPauseSeconds}s, total pause ratio: ${metrics.pauseRatio}`,
      metrics.prosody && metrics.prosody.voicedFrames > 0
        ? [
            "",
            "Sona (from real-time pitch tracking on their voice):",
            `- Median pitch: ${metrics.prosody.pitchMedianHz} Hz (min ${metrics.prosody.pitchMinHz}, max ${metrics.prosody.pitchMaxHz})`,
            `- Pitch range: ${metrics.prosody.pitchRangeSemitones} semitones`,
            `- Pitch variation (CV): ${metrics.prosody.pitchVariation} — higher = more expressive`,
            `- End-of-phrase contour: ${metrics.prosody.endingContour} (-1 falling, +1 rising)`,
            `- Loudness dynamics: ${metrics.prosody.loudnessDynamics} (range of RMS, 0-1 scale)`,
            `- Voiced frames: ${metrics.prosody.voicedFrames}/${metrics.prosody.totalFrames}`,
          ].join("\n")
        : "- Sona: not available (recorded on a platform without pitch tracking yet)",
    ]
      .filter(Boolean)
      .join("\n");

    const feedback = await callClaudeJson<CoachingFeedback>({
      system: COACH_SYSTEM,
      user: userPrompt,
      maxTokens: 1500,
    });
    return c.json(feedback);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

const calibrateSchema = z.object({
  transcript: z.string().min(1),
  metrics: z.object({
    durationSeconds: z.number(),
    wordCount: z.number(),
    wordsPerMinute: z.number(),
    fillerCount: z.number(),
    fillerWords: z.array(z.string()),
    longestPauseSeconds: z.number(),
    pauseRatio: z.number(),
    prosody: prosodySchema.optional(),
  }),
  previousArchetype: z.string().optional(),
});

app.post("/api/calibrate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = calibrateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", issues: parsed.error.issues }, 400);
  }

  try {
    const { transcript, metrics, previousArchetype } = parsed.data;
    const userPrompt = [
      previousArchetype
        ? `Previous archetype: ${previousArchetype}. This is a re-calibration; let it evolve if you heard a shift.`
        : "First calibration — no prior archetype.",
      "",
      "User's open speaking sample (60-90 sec):",
      transcript,
      "",
      "Voice metrics:",
      `- Duration: ${metrics.durationSeconds}s, ${metrics.wordCount} words, ${metrics.wordsPerMinute} wpm`,
      `- Fillers: ${metrics.fillerCount}${metrics.fillerWords.length ? ` (${metrics.fillerWords.slice(0, 8).join(", ")})` : ""}`,
      `- Longest pause: ${metrics.longestPauseSeconds}s, pause ratio: ${metrics.pauseRatio}`,
      metrics.prosody && metrics.prosody.voicedFrames > 0
        ? [
            `- Median pitch: ${metrics.prosody.pitchMedianHz} Hz`,
            `- Pitch range: ${metrics.prosody.pitchRangeSemitones} semitones`,
            `- Pitch variation: ${metrics.prosody.pitchVariation}`,
            `- Loudness dynamics: ${metrics.prosody.loudnessDynamics}`,
          ].join("\n")
        : "- Sona: unavailable",
    ].join("\n");

    const result = await callClaudeJson<CalibrateResponse>({
      system: CALIBRATE_SYSTEM,
      user: userPrompt,
      maxTokens: 800,
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

const conversationRatingSchema = z.object({
  presence: z.number(),
  specificity: z.number(),
  depth: z.number(),
  listenability: z.number(),
  note: z.string(),
});

const converseSchema = z.object({
  theme: z.enum(["interview", "story", "reflection", "debate"]),
  archetypeName: z.string().optional(),
  archetypeContext: z.string().optional(),
  growthEdges: z.array(z.string()).optional(),
  history: z.array(
    z.object({
      question: z.string(),
      userTranscript: z.string(),
      metrics: z.any().optional(),
      rating: conversationRatingSchema.optional(),
    }),
  ),
  current: z
    .object({
      question: z.string(),
      userTranscript: z.string().min(1),
      metrics: z.object({
        durationSeconds: z.number(),
        wordCount: z.number(),
        wordsPerMinute: z.number(),
        fillerCount: z.number(),
        fillerWords: z.array(z.string()),
        longestPauseSeconds: z.number(),
        pauseRatio: z.number(),
        prosody: prosodySchema.optional(),
      }),
    })
    .optional(),
  maxTurns: z.number().int().min(1).max(8),
});

app.post("/api/converse", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = converseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", issues: parsed.error.issues },
      400,
    );
  }

  try {
    const {
      theme,
      archetypeName,
      archetypeContext,
      growthEdges,
      history,
      current,
      maxTurns,
    } = parsed.data;

    const turnsCompleted = history.length;
    const turnsAfterThis = current ? turnsCompleted + 1 : turnsCompleted;
    const atLimit = turnsAfterThis >= maxTurns;

    const lines: string[] = [];
    lines.push(`THEME: ${theme}`);
    lines.push(`MAX_TURNS: ${maxTurns}`);
    lines.push(`TURNS_COMPLETED_AFTER_THIS_RATING: ${turnsAfterThis}`);
    lines.push(`AT_LIMIT_NOW: ${atLimit ? "yes" : "no"}`);
    if (archetypeName) lines.push(`ARCHETYPE: ${archetypeName}`);
    if (archetypeContext)
      lines.push(`ARCHETYPE_CONTEXT: ${archetypeContext}`);
    if (growthEdges?.length)
      lines.push(`GROWTH_EDGES:\n- ${growthEdges.join("\n- ")}`);

    if (history.length) {
      lines.push("");
      lines.push("HISTORY:");
      history.forEach((turn, i) => {
        lines.push(`[T${i + 1} Q] ${turn.question}`);
        lines.push(`[T${i + 1} A] ${turn.userTranscript}`);
        if (turn.rating)
          lines.push(
            `[T${i + 1} RATING] presence=${turn.rating.presence} specificity=${turn.rating.specificity} depth=${turn.rating.depth} listenability=${turn.rating.listenability} — ${turn.rating.note}`,
          );
      });
    }

    if (current) {
      lines.push("");
      lines.push("CURRENT TURN TO RATE:");
      lines.push(`Q: ${current.question}`);
      lines.push(`A: ${current.userTranscript}`);
      const m = current.metrics;
      lines.push(
        `Voice: ${m.durationSeconds}s, ${m.wordsPerMinute} wpm, ${m.fillerCount} fillers, pauseRatio ${m.pauseRatio}`,
      );
      if (m.prosody && m.prosody.voicedFrames > 0) {
        lines.push(
          `Sona: pitchRange=${m.prosody.pitchRangeSemitones}st, variation=${m.prosody.pitchVariation}, dynamics=${m.prosody.loudnessDynamics}`,
        );
      }
    } else {
      lines.push("");
      lines.push("NO CURRENT TURN — open the session with the first question.");
    }

    const result = await callClaudeJson<ConverseResponse>({
      system: CONVERSATION_SYSTEM,
      user: lines.join("\n"),
      maxTokens: 1100,
    });
    return c.json(result);
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err;
    return c.json({ error: (err as Error).message }, 500);
  }
});

const improvSchema = z.object({
  videoTitle: z.string().optional(),
  recentConstraints: z.array(z.string()).optional(),
});

app.post("/api/improv", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = improvSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request" }, 400);
  }

  try {
    const userPrompt = [
      parsed.data.videoTitle
        ? `Video they'll describe: ${parsed.data.videoTitle}`
        : "No video context yet — keep the constraint general.",
      parsed.data.recentConstraints?.length
        ? `Recent constraints (do not repeat):\n- ${parsed.data.recentConstraints.join("\n- ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await callClaudeJson<ImprovPrompt>({
      system: IMPROV_SYSTEM,
      user: userPrompt,
      maxTokens: 300,
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default app;
