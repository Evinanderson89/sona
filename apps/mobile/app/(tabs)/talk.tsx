import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import {
  computeMetrics,
  type ConversationSession,
  type ConversationTheme,
  type ConversationTurn,
  type ConversationTurnRating,
  type SpeechMetrics,
  type UserProfile,
} from "@sona/shared";
import { Button } from "../../components/Button";
import { theme } from "../../lib/theme";
import { startRecording, type ActiveRecording } from "../../lib/recorder";
import { api } from "../../lib/api";
import { getProfile, saveConversation } from "../../lib/storage";

const MAX_TURNS = 3;

interface ThemeOption {
  id: ConversationTheme;
  label: string;
  blurb: string;
}

const THEMES: ThemeOption[] = [
  {
    id: "interview",
    label: "Interview",
    blurb: "A podcast host asks about your work and your thinking.",
  },
  {
    id: "story",
    label: "Story",
    blurb: "Tell a specific moment from your life. Real stakes, real detail.",
  },
  {
    id: "reflection",
    label: "Reflection",
    blurb: "Open philosophical questions about belief, change, regret.",
  },
  {
    id: "debate",
    label: "Debate",
    blurb: "Defend a position. The interviewer pushes back.",
  },
];

type Phase =
  | "pick"
  | "loading-question"
  | "ready"
  | "recording"
  | "review"
  | "scoring"
  | "done"
  | "error";

export default function TalkScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [theme0, setTheme0] = useState<ThemeOption | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [summary, setSummary] = useState<
    ConversationSession["finalSummary"] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const sessionIdRef = useRef<string>("");
  const recordingRef = useRef<ActiveRecording | null>(null);
  const recordingMetaRef = useRef<{
    durationSeconds: number;
    pauseSegments: Array<{ startSec: number; endSec: number }>;
    prosody?: import("@sona/shared").ProsodyMetrics;
  } | null>(null);

  const load = useCallback(async () => {
    setProfile(await getProfile());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (phase !== "recording") return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

  async function onPickTheme(t: ThemeOption) {
    setTheme0(t);
    sessionIdRef.current = `talk-${Date.now()}`;
    setTurns([]);
    setSummary(null);
    setTranscript("");
    setPhase("loading-question");
    try {
      const res = await api.converse({
        theme: t.id,
        archetypeName: profile?.archetypeName,
        archetypeContext: profile?.archetypeDescription,
        growthEdges: profile?.growthEdges,
        history: [],
        maxTurns: MAX_TURNS,
      });
      if (!res.nextQuestion) throw new Error("No opening question returned.");
      setCurrentQuestion(res.nextQuestion);
      setPhase("ready");
    } catch (err) {
      showError((err as Error).message);
    }
  }

  async function onStart() {
    try {
      const rec = await startRecording();
      recordingRef.current = rec;
      setElapsed(0);
      setPhase("recording");
    } catch (err) {
      showError((err as Error).message);
    }
  }

  async function onStop() {
    const rec = recordingRef.current;
    if (!rec) return;
    try {
      const result = await rec.stop();
      recordingRef.current = null;
      setTranscript(result.transcript);
      recordingMetaRef.current = {
        durationSeconds: result.durationSeconds,
        pauseSegments: result.pauseSegments,
        prosody: result.prosody,
      };
      setPhase("review");
    } catch (err) {
      showError((err as Error).message);
    }
  }

  async function onSubmit() {
    if (!theme0) return;
    if (!transcript.trim()) {
      showError("Need a transcript to score.");
      return;
    }
    setPhase("scoring");
    try {
      const meta = recordingMetaRef.current ?? {
        durationSeconds: Math.max(8, transcript.split(/\s+/).length / 2.5),
        pauseSegments: [],
      };
      const metrics = computeMetrics({
        transcript,
        durationSeconds: meta.durationSeconds,
        pauseSegments: meta.pauseSegments,
        prosody: meta.prosody,
      });
      const res = await api.converse({
        theme: theme0.id,
        archetypeName: profile?.archetypeName,
        archetypeContext: profile?.archetypeDescription,
        growthEdges: profile?.growthEdges,
        history: turns.map((t) => ({
          question: t.question,
          userTranscript: t.userTranscript,
          metrics: t.metrics,
          rating: t.rating,
        })),
        current: {
          question: currentQuestion,
          userTranscript: transcript,
          metrics,
        },
        maxTurns: MAX_TURNS,
      });

      if (!res.rating) throw new Error("Coach didn't return a rating.");
      const nowIso = new Date().toISOString();
      const finishedTurn: ConversationTurn = {
        question: currentQuestion,
        userTranscript: transcript,
        metrics,
        rating: res.rating,
        askedAt: nowIso,
        answeredAt: nowIso,
      };
      const nextTurns = [...turns, finishedTurn];
      setTurns(nextTurns);
      setTranscript("");
      recordingMetaRef.current = null;

      if (res.finalSummary) {
        const session: ConversationSession = {
          id: sessionIdRef.current,
          createdAt: nowIso,
          theme: theme0.id,
          themeLabel: theme0.label,
          turns: nextTurns,
          finalSummary: res.finalSummary,
        };
        await saveConversation(session);
        setSummary(res.finalSummary);
        setPhase("done");
      } else if (res.nextQuestion) {
        setCurrentQuestion(res.nextQuestion);
        setPhase("ready");
      } else {
        // Coach didn't give us either — wrap up gracefully
        setPhase("done");
      }
    } catch (err) {
      showError((err as Error).message);
    }
  }

  function showError(msg: string) {
    setError(msg);
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert("Hmm", msg);
    setPhase((p) =>
      p === "scoring" ? "review" : p === "loading-question" ? "pick" : p,
    );
  }

  function restart() {
    setTheme0(null);
    setCurrentQuestion("");
    setTurns([]);
    setSummary(null);
    setTranscript("");
    setPhase("pick");
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: theme.colors.bg }}
    >
      {phase === "pick" ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>CONVERSATION</Text>
          <Text style={styles.title}>Pick a session</Text>
          <Text style={styles.lede}>
            Three rounds. The interviewer asks, you speak, you get rated. Each
            follow-up is built from what you just said.
          </Text>
          <View style={styles.themeList}>
            {THEMES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => onPickTheme(t)}
                style={({ hovered, pressed }: any) => [
                  styles.themeCard,
                  (hovered || pressed) && {
                    borderColor: theme.colors.borderHi,
                  },
                ]}
              >
                <Text style={styles.themeLabel}>{t.label}</Text>
                <Text style={styles.themeBlurb}>{t.blurb}</Text>
                <Text style={styles.themeArrow}>Begin →</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {phase !== "pick" && theme0 ? (
        <View style={styles.headSession}>
          <Text style={styles.eyebrow}>
            {theme0.label.toUpperCase()} · TURN {turns.length + (phase === "done" ? 0 : 1)} OF {MAX_TURNS}
          </Text>
        </View>
      ) : null}

      {turns.length > 0 ? (
        <View style={styles.turnsList}>
          {turns.map((t, i) => (
            <View key={i} style={styles.turn}>
              <View style={styles.turnHead}>
                <Text style={styles.turnNum}>T{i + 1}</Text>
                <View style={styles.miniScores}>
                  <MiniScore label="P" value={t.rating.presence} />
                  <MiniScore label="S" value={t.rating.specificity} />
                  <MiniScore label="D" value={t.rating.depth} />
                  <MiniScore label="L" value={t.rating.listenability} />
                </View>
              </View>
              <Text style={styles.turnQ}>{t.question}</Text>
              <Text style={styles.turnA}>"{t.userTranscript}"</Text>
              <Text style={styles.turnNote}>{t.rating.note}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {phase === "loading-question" || phase === "scoring" ? (
        <View style={styles.thinking}>
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={styles.thinkingText}>
            {phase === "scoring" ? "Reading your answer…" : "Coming up with a question…"}
          </Text>
        </View>
      ) : null}

      {phase === "ready" || phase === "recording" || phase === "review" ? (
        <View style={styles.qBlock}>
          <Text style={styles.questionEyebrow}>QUESTION</Text>
          <Text style={styles.question}>{currentQuestion}</Text>
        </View>
      ) : null}

      {phase === "ready" ? (
        <View style={styles.actions}>
          <Button title="Start answering" size="lg" onPress={onStart} />
        </View>
      ) : null}

      {phase === "recording" ? (
        <View style={styles.recording}>
          <View style={styles.pulseRing}>
            <View style={styles.pulseDot} />
          </View>
          <Text style={styles.recordingTime}>{formatTime(elapsed)}</Text>
          <Button title="Stop" variant="danger" onPress={onStop} />
        </View>
      ) : null}

      {phase === "review" ? (
        <View style={styles.reviewBlock}>
          <Text style={styles.label}>YOUR ANSWER</Text>
          <TextInput
            value={transcript}
            onChangeText={setTranscript}
            multiline
            placeholder="(speech recognition will fill this in — you can edit)"
            placeholderTextColor={theme.colors.inkFaint}
            style={styles.textarea}
          />
          <Button
            size="lg"
            title="Submit answer"
            onPress={onSubmit}
            disabled={!transcript.trim()}
          />
          <Pressable onPress={onStart} style={styles.redo}>
            <Text style={styles.redoText}>← Record again</Text>
          </Pressable>
        </View>
      ) : null}

      {phase === "done" && summary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryEyebrow}>SESSION SUMMARY</Text>
          <Text style={styles.summaryScore}>{summary.averageScore}/10</Text>
          <Text style={styles.summaryOverall}>{summary.overall}</Text>
          <Text style={styles.subLabel}>WHAT WORKED</Text>
          {summary.strengths.map((s, i) => (
            <Text key={i} style={styles.bullet}>
              · {s}
            </Text>
          ))}
          <Text style={styles.subLabel}>NEXT TIME</Text>
          {summary.growthEdges.map((s, i) => (
            <Text key={i} style={styles.bullet}>
              · {s}
            </Text>
          ))}
          <View style={{ height: 18 }} />
          <Button title="New conversation" onPress={restart} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniScore}>
      <Text style={styles.miniScoreValue}>{value}</Text>
      <Text style={styles.miniScoreLabel}>{label}</Text>
    </View>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 60,
    gap: 22,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  section: { gap: 12 },
  headSession: {},
  eyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.inkFaint,
    letterSpacing: 1.4,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  title: {
    fontFamily: theme.font.display,
    color: theme.colors.ink,
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: -0.8,
    marginTop: 2,
  },
  lede: {
    fontFamily: theme.font.body,
    color: theme.colors.inkDim,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 2,
  },
  themeList: { gap: 10, marginTop: 8 },
  themeCard: {
    padding: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  themeLabel: {
    fontFamily: theme.font.display,
    fontSize: 20,
    color: theme.colors.ink,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  themeBlurb: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.inkDim,
    lineHeight: 19,
  },
  themeArrow: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.accent,
    fontWeight: "600",
    marginTop: 4,
  },
  turnsList: { gap: 10 },
  turn: {
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  turnHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  turnNum: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.accent,
    fontWeight: "700",
    letterSpacing: 1,
  },
  miniScores: { flexDirection: "row", gap: 6 },
  miniScore: {
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
  },
  miniScoreValue: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  miniScoreLabel: {
    fontFamily: theme.font.mono,
    fontSize: 8,
    color: theme.colors.inkFaint,
    letterSpacing: 0.8,
  },
  turnQ: {
    fontFamily: theme.font.display,
    fontSize: 14,
    color: theme.colors.ink,
    fontWeight: "600",
  },
  turnA: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.inkDim,
    lineHeight: 19,
    fontStyle: "italic",
  },
  turnNote: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.accent,
    lineHeight: 17,
  },
  qBlock: {
    padding: 18,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  questionEyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.accent,
    letterSpacing: 1.3,
    fontWeight: "700",
    marginBottom: 8,
  },
  question: {
    fontFamily: theme.font.display,
    fontSize: 22,
    lineHeight: 30,
    color: theme.colors.ink,
    fontWeight: "500",
    letterSpacing: -0.4,
  },
  actions: { gap: 8 },
  recording: {
    padding: 24,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    gap: 14,
  },
  pulseRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentMuted,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
  },
  recordingTime: {
    fontFamily: theme.font.mono,
    color: theme.colors.ink,
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  reviewBlock: { gap: 10 },
  label: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1.3,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  textarea: {
    fontFamily: theme.font.body,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    textAlignVertical: "top",
  },
  redo: { alignSelf: "center", paddingVertical: 6 },
  redoText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.inkDim,
  },
  thinking: {
    padding: 22,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    gap: 10,
  },
  thinkingText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.inkDim,
  },
  summary: {
    padding: 22,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  summaryEyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.accent,
    letterSpacing: 1.3,
    fontWeight: "700",
  },
  summaryScore: {
    fontFamily: theme.font.display,
    fontSize: 56,
    color: theme.colors.ink,
    fontWeight: "600",
    letterSpacing: -2,
    marginVertical: 4,
  },
  summaryOverall: {
    fontFamily: theme.font.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.ink,
    marginBottom: 6,
  },
  subLabel: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1.2,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 10,
  },
  bullet: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.ink,
  },
});
