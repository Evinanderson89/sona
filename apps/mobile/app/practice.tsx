import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  computeMetrics,
  type VideoAnalysis,
  type CoachingFeedback,
  type JournalEntry,
  type SpeechMetrics,
} from "@sona/shared";
import { api } from "../lib/api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { VideoPlayer } from "../components/VideoPlayer";
import { theme } from "../lib/theme";
import { startRecording, type ActiveRecording } from "../lib/recorder";
import {
  appendJournal,
  bumpTakesSinceCalibration,
  getProfile,
  pushBreakthroughs,
} from "../lib/storage";
import { detectBreakthroughs } from "../lib/breakthroughs";

type Phase = "loading" | "ready" | "recording" | "scoring" | "done" | "error";

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ url: string; constraint?: string }>();
  const url = params.url ?? "";
  const constraint = params.constraint;
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<CoachingFeedback | null>(null);
  const [lastMetrics, setLastMetrics] = useState<SpeechMetrics | null>(null);
  const recordingRef = useRef<ActiveRecording | null>(null);
  const recordingMetaRef = useRef<{
    durationSeconds: number;
    pauseSegments: Array<{ startSec: number; endSec: number }>;
    prosody?: import("@sona/shared").ProsodyMetrics;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    api
      .analyzeVideo({ url })
      .then((res) => {
        if (cancelled) return;
        setAnalysis(res);
        setPhase("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMsg(err.message);
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function onRecord() {
    try {
      const rec = await startRecording();
      recordingRef.current = rec;
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
      setPhase("ready");
    } catch (err) {
      showError((err as Error).message);
    }
  }

  async function onScore() {
    if (!analysis || !transcript.trim()) {
      showError("Record or type a description first.");
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
      const fb = await api.coach({
        videoContext: {
          title: analysis.title,
          summary: analysis.summary,
          transcriptExcerpt: analysis.transcriptExcerpt,
        },
        userTranscript: transcript,
        metrics,
        improvConstraint: constraint,
      });
      setFeedback(fb);
      setLastMetrics(metrics);
      const entry: JournalEntry = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        video: {
          videoId: analysis.videoId,
          url: analysis.url,
          title: analysis.title,
        },
        improvConstraint: constraint,
        userTranscript: transcript,
        metrics,
        feedback: fb,
      };
      await appendJournal(entry);

      // Detect breakthroughs against baseline + bump drift counter
      const profile = await getProfile();
      if (profile) {
        const wins = detectBreakthroughs(entry, profile);
        if (wins.length > 0) await pushBreakthroughs(wins);
        await bumpTakesSinceCalibration();
      }

      setPhase("done");
    } catch (err) {
      showError((err as Error).message);
    }
  }

  function reset() {
    setTranscript("");
    setFeedback(null);
    setLastMetrics(null);
    recordingMetaRef.current = null;
    setPhase("ready");
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert("Something went wrong", msg);
    setPhase((p) => (p === "scoring" || p === "recording" ? "ready" : p));
  }

  if (phase === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.dim}>Analyzing video…</Text>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Couldn't analyze that video</Text>
        <Text style={styles.dim}>{errorMsg}</Text>
        <View style={{ height: 16 }} />
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (!analysis) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <VideoPlayer videoId={analysis.videoId} />
      <Text style={styles.title}>{analysis.title}</Text>
      {analysis.channel ? (
        <Text style={styles.dim}>{analysis.channel}</Text>
      ) : null}

      {constraint ? (
        <Card style={{ borderColor: theme.colors.accent }}>
          <Text style={styles.label}>Improv constraint</Text>
          <Text style={styles.constraint}>{constraint}</Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>Try one of these on for size</Text>
        {analysis.styles.map((s) => (
          <View key={s.style} style={styles.styleBlock}>
            <Text style={styles.styleLabel}>{s.label}</Text>
            <Text style={styles.styleDesc}>{s.description}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.label}>Your turn</Text>
        {phase === "recording" ? (
          <Button title="Stop recording" variant="danger" onPress={onStop} />
        ) : (
          <Button title="Record your description" onPress={onRecord} />
        )}
        <View style={{ height: 12 }} />
        <Text style={styles.label}>What you said</Text>
        <TextInput
          value={transcript}
          onChangeText={setTranscript}
          multiline
          placeholder="Speak above, or type/paste here."
          placeholderTextColor={theme.colors.textDim}
          style={styles.textarea}
        />
        <View style={{ height: 12 }} />
        <Button
          title="Score me"
          onPress={onScore}
          loading={phase === "scoring"}
          disabled={!transcript.trim() || phase === "recording"}
        />
      </Card>

      {feedback ? (
        <FeedbackBlock
          feedback={feedback}
          metrics={lastMetrics}
          onAgain={reset}
        />
      ) : null}
    </ScrollView>
  );
}

function VoiceReadout({ metrics }: { metrics: SpeechMetrics }) {
  const p = metrics.prosody;
  if (!p || p.voicedFrames === 0) {
    return (
      <Text style={styles.dim}>
        Voice analysis isn't available for this take (try recording in Chrome or
        Safari on the web build).
      </Text>
    );
  }
  const contourLabel =
    p.endingContour > 0.25
      ? "rising"
      : p.endingContour < -0.25
        ? "falling"
        : "flat";
  const rangeLabel =
    p.pitchRangeSemitones < 4
      ? "narrow"
      : p.pitchRangeSemitones < 8
        ? "conversational"
        : p.pitchRangeSemitones < 14
          ? "expressive"
          : "very dynamic";
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.scoreRow}>
        <Score label="Range" value={p.pitchRangeSemitones} suffix="st" />
        <Score
          label="Variation"
          value={Math.round(p.pitchVariation * 100)}
          suffix="%"
        />
        <Score
          label="Dynamics"
          value={Math.round(p.loudnessDynamics * 100)}
          suffix=""
        />
      </View>
      <Text style={styles.body}>
        Median pitch {Math.round(p.pitchMedianHz)} Hz · {rangeLabel} range ·
        ending contour {contourLabel}
      </Text>
    </View>
  );
}

function FeedbackBlock({
  feedback,
  metrics,
  onAgain,
}: {
  feedback: CoachingFeedback;
  metrics: SpeechMetrics | null;
  onAgain: () => void;
}) {
  return (
    <Card>
      <Text style={styles.label}>Coach</Text>
      <Text style={styles.body}>{feedback.overall}</Text>

      <View style={styles.scoreRow}>
        <Score label="Vivid" value={feedback.vividnessScore} />
        <Score label="Warm" value={feedback.warmthScore} />
        <Score label="Engaging" value={feedback.engagementScore} />
      </View>

      {metrics ? (
        <>
          <Text style={styles.subLabel}>Voice</Text>
          <VoiceReadout metrics={metrics} />
        </>
      ) : null}

      <Text style={styles.subLabel}>Strengths</Text>
      {feedback.strengths.map((s, i) => (
        <Text key={i} style={styles.bullet}>
          • {s}
        </Text>
      ))}

      <Text style={styles.subLabel}>Growth edges</Text>
      {feedback.growthEdges.map((s, i) => (
        <Text key={i} style={styles.bullet}>
          • {s}
        </Text>
      ))}

      <Text style={styles.subLabel}>Rewrite</Text>
      <Text style={styles.rewrite}>"{feedback.rewrite}"</Text>
      <Text style={styles.dim}>{feedback.rewriteNotes}</Text>

      <View style={{ height: 16 }} />
      <Button title="Try another take" onPress={onAgain} />
    </Card>
  );
}

function Score({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <View style={styles.score}>
      <Text style={styles.scoreValue}>
        {value}
        {suffix ? <Text style={styles.scoreSuffix}>{suffix}</Text> : null}
      </Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  dim: {
    color: theme.colors.textDim,
    fontSize: 14,
  },
  errorTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  label: {
    color: theme.colors.textDim,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subLabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  styleBlock: {
    marginBottom: 12,
  },
  styleLabel: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  styleDesc: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  constraint: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  textarea: {
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.text,
    minHeight: 100,
    borderRadius: theme.radius.sm,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
  },
  body: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  bullet: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  rewrite: {
    color: theme.colors.text,
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 24,
    marginBottom: 6,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  score: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  scoreValue: {
    color: theme.colors.accent,
    fontSize: 24,
    fontWeight: "700",
  },
  scoreSuffix: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: "500",
  },
  scoreLabel: {
    color: theme.colors.textDim,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
