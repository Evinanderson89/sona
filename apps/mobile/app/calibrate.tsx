import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  computeMetrics,
  type SpeechMetrics,
  type UserProfile,
} from "@sona/shared";
import { Button } from "../components/Button";
import { theme } from "../lib/theme";
import { startRecording, type ActiveRecording } from "../lib/recorder";
import { api } from "../lib/api";
import { getProfile, saveProfile } from "../lib/storage";
import { enterDemoMode } from "../lib/demo";

const PROMPT =
  "Tell me about a place that mattered to you as a kid. Don't prepare. Just talk for about a minute.";

type Phase = "idle" | "recording" | "review" | "submitting";

export default function CalibrateScreen() {
  const params = useLocalSearchParams<{ recalibrate?: string }>();
  const isRecalibrate = params.recalibrate === "1";

  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const recordingRef = useRef<ActiveRecording | null>(null);
  const recordingMetaRef = useRef<{
    durationSeconds: number;
    pauseSegments: Array<{ startSec: number; endSec: number }>;
    prosody?: import("@sona/shared").ProsodyMetrics;
  } | null>(null);

  useEffect(() => {
    if (phase !== "recording") return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);

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
    if (!transcript.trim()) {
      showError("Need a transcript to calibrate.");
      return;
    }
    setPhase("submitting");
    try {
      const meta = recordingMetaRef.current ?? {
        durationSeconds: Math.max(30, transcript.split(/\s+/).length / 2.5),
        pauseSegments: [],
      };
      const metrics = computeMetrics({
        transcript,
        durationSeconds: meta.durationSeconds,
        pauseSegments: meta.pauseSegments,
        prosody: meta.prosody,
      });
      const existing = await getProfile();
      const result = await api.calibrate({
        transcript,
        metrics,
        previousArchetype: existing?.archetypeName,
      });
      const baseline = baselineFromMetrics(metrics);
      const nextVersion = (existing?.version ?? 0) + 1;
      const profile: UserProfile = {
        version: nextVersion,
        archetypeName: result.archetypeName,
        archetypeDescription: result.archetypeDescription,
        growthEdges: result.growthEdges,
        baseline,
        takesSinceCalibration: 0,
        lastCalibratedAt: new Date().toISOString(),
        history: [
          {
            version: nextVersion,
            archetypeName: result.archetypeName,
            baseline,
            createdAt: new Date().toISOString(),
          },
          ...(existing?.history ?? []),
        ].slice(0, 12),
      };
      await saveProfile(profile);
      router.replace("/");
    } catch (err) {
      showError((err as Error).message);
    }
  }

  function showError(msg: string) {
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert("Hmm", msg);
    if (phase === "submitting") setPhase("review");
    else if (phase === "recording") setPhase("idle");
  }

  async function onTryDemo() {
    await enterDemoMode();
    router.replace("/");
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: theme.colors.bg }}
    >
      <View style={styles.head}>
        <Text style={styles.eyebrow}>
          {isRecalibrate ? "RE-CALIBRATION" : "CALIBRATION"}
        </Text>
        <Text style={styles.title}>
          {isRecalibrate ? "Listen again." : "Let's hear you first."}
        </Text>
        <Text style={styles.lede}>
          {isRecalibrate
            ? "Ten takes in. Let's see who you are now."
            : "Ninety seconds of unrehearsed talking. The system listens for your texture, pace, and defaults — then everything coaches against that line."}
        </Text>
      </View>

      <View style={styles.promptCard}>
        <Text style={styles.promptEyebrow}>PROMPT</Text>
        <Text style={styles.promptText}>{PROMPT}</Text>
      </View>

      {phase === "idle" ? (
        <View style={styles.actions}>
          <Button title="Start recording" size="lg" onPress={onStart} />
          <Text style={styles.fineprint}>
            Your microphone will turn on. Talk freely. Stop when you feel done.
          </Text>
          {!isRecalibrate ? (
            <View style={styles.demoBox}>
              <View>
                <Text style={styles.demoTitle}>Just want to look around?</Text>
                <Text style={styles.demoBody}>
                  Skip calibration and explore the app with pre-loaded demo data.
                </Text>
              </View>
              <Pressable onPress={onTryDemo} style={styles.demoLink}>
                <Text style={styles.demoLinkText}>Try demo mode →</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === "recording" ? (
        <View style={styles.recording}>
          <View style={styles.pulseRing}>
            <View style={styles.pulseDot} />
          </View>
          <Text style={styles.recordingTime}>{formatTime(elapsed)}</Text>
          <Text style={styles.recordingHint}>
            Aim for about 60–90 seconds. No rush.
          </Text>
          <Button title="Stop recording" variant="danger" onPress={onStop} />
        </View>
      ) : null}

      {phase === "review" || phase === "submitting" ? (
        <View style={styles.review}>
          <Text style={styles.eyebrowSmall}>TRANSCRIPT</Text>
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
            title={phase === "submitting" ? "Reading you…" : "Read me"}
            onPress={onSubmit}
            loading={phase === "submitting"}
            disabled={!transcript.trim()}
          />
          {phase === "review" ? (
            <Pressable onPress={onStart} style={styles.redo}>
              <Text style={styles.redoText}>← Record again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function baselineFromMetrics(m: SpeechMetrics) {
  const p = m.prosody;
  return {
    pitchMedianHz: p?.pitchMedianHz ?? 0,
    pitchRangeSemitones: p?.pitchRangeSemitones ?? 0,
    pitchVariation: p?.pitchVariation ?? 0,
    loudnessDynamics: p?.loudnessDynamics ?? 0,
    wordsPerMinute: m.wordsPerMinute,
    fillerRate: m.fillerCount / Math.max(m.durationSeconds / 60, 0.1),
  };
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 60,
    gap: 24,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  head: {
    gap: 8,
  },
  eyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.inkFaint,
    letterSpacing: 1.5,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  eyebrowSmall: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1.2,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    fontFamily: theme.font.display,
    color: theme.colors.ink,
    fontSize: 40,
    fontWeight: "600",
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  lede: {
    fontFamily: theme.font.body,
    color: theme.colors.inkDim,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 6,
  },
  promptCard: {
    padding: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  promptEyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.accent,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  promptText: {
    fontFamily: theme.font.display,
    fontSize: 18,
    lineHeight: 26,
    color: theme.colors.ink,
    fontWeight: "500",
  },
  actions: {
    gap: 12,
  },
  fineprint: {
    fontFamily: theme.font.body,
    color: theme.colors.inkFaint,
    fontSize: 13,
    textAlign: "center",
  },
  recording: {
    padding: 28,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    gap: 16,
  },
  pulseRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentMuted,
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.accent,
  },
  recordingTime: {
    fontFamily: theme.font.mono,
    color: theme.colors.ink,
    fontSize: 38,
    fontWeight: "600",
    letterSpacing: 2,
  },
  recordingHint: {
    fontFamily: theme.font.body,
    color: theme.colors.inkDim,
    fontSize: 13,
  },
  review: {
    gap: 12,
  },
  textarea: {
    fontFamily: theme.font.body,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 160,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    textAlignVertical: "top",
  },
  redo: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  redoText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.inkDim,
  },
  demoBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 10,
  },
  demoTitle: {
    fontFamily: theme.font.display,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.ink,
  },
  demoBody: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.inkDim,
    marginTop: 2,
    lineHeight: 18,
  },
  demoLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  demoLinkText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.accent,
  },
});
