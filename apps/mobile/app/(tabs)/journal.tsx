import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import type {
  JournalEntry,
  UserProfile,
  Breakthrough,
} from "@sona/shared";
import { theme } from "../../lib/theme";
import {
  listJournal,
  getProfile,
  listBreakthroughs,
} from "../../lib/storage";
import { api } from "../../lib/api";

const QUICK_QUESTIONS = [
  "What's improving?",
  "What's holding me back?",
  "Pick a clip for me to try next.",
  "Summarize my last week.",
];

export default function JournalScreen() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [breakthroughs, setBreakthroughs] = useState<Breakthrough[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Bot state
  const [botInput, setBotInput] = useState("");
  const [botAnswer, setBotAnswer] = useState<string | null>(null);
  const [botLoading, setBotLoading] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [list, p, b] = await Promise.all([
      listJournal(),
      getProfile(),
      listBreakthroughs(),
    ]);
    setEntries(list);
    setProfile(p);
    setBreakthroughs(b);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  async function askBot(question: string) {
    setBotError(null);
    setBotAnswer(null);
    setBotInput(question);
    setBotLoading(true);
    try {
      const res = await api.journalChat({
        question,
        archetypeName: profile?.archetypeName,
        archetypeContext: profile?.archetypeDescription,
        growthEdges: profile?.growthEdges,
        baseline: profile?.baseline,
        recentTakes: entries.slice(0, 10).map((e) => ({
          createdAt: e.createdAt,
          videoTitle: e.video.title,
          transcriptExcerpt: e.userTranscript.slice(0, 240),
          vividness: e.feedback.vividnessScore,
          warmth: e.feedback.warmthScore,
          engagement: e.feedback.engagementScore,
          wordsPerMinute: e.metrics.wordsPerMinute,
          pitchRangeSemitones: e.metrics.prosody?.pitchRangeSemitones,
        })),
        recentBreakthroughs: breakthroughs.slice(0, 8),
      });
      setBotAnswer(res.answer);
    } catch (err) {
      setBotError((err as Error).message);
    } finally {
      setBotLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: theme.colors.bg }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={load}
          tintColor={theme.colors.accent}
        />
      }
    >
      {/* BOT WIDGET */}
      <View style={styles.bot}>
        <View style={styles.botHead}>
          <View style={styles.botBadge}>
            <Text style={styles.botBadgeText}>HAIKU</Text>
          </View>
          <Text style={styles.botTitle}>Ask about your takes</Text>
        </View>

        <View style={styles.chipRow}>
          {QUICK_QUESTIONS.map((q) => (
            <Pressable
              key={q}
              onPress={() => askBot(q)}
              disabled={botLoading || entries.length === 0}
              style={({ hovered, pressed }: any) => [
                styles.chip,
                (hovered || pressed) && {
                  borderColor: theme.colors.accent,
                  backgroundColor: theme.colors.accentMuted,
                },
                (botLoading || entries.length === 0) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.chipText}>{q}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            value={botInput}
            onChangeText={setBotInput}
            placeholder={
              entries.length === 0
                ? "Record a take first…"
                : "Ask anything about your history"
            }
            placeholderTextColor={theme.colors.inkFaint}
            style={styles.input}
            editable={!botLoading && entries.length > 0}
            onSubmitEditing={() => botInput.trim() && askBot(botInput.trim())}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => botInput.trim() && askBot(botInput.trim())}
            disabled={!botInput.trim() || botLoading}
            style={({ hovered, pressed }: any) => [
              styles.sendBtn,
              (hovered || pressed) && { backgroundColor: theme.colors.accentDeep },
              (!botInput.trim() || botLoading) && { opacity: 0.5 },
            ]}
          >
            {botLoading ? (
              <ActivityIndicator color={theme.colors.onAccent} size="small" />
            ) : (
              <Text style={styles.sendBtnText}>→</Text>
            )}
          </Pressable>
        </View>

        {botAnswer ? (
          <View style={styles.botAnswer}>
            <Text style={styles.botAnswerText}>{botAnswer}</Text>
          </View>
        ) : null}
        {botError ? <Text style={styles.botErr}>{botError}</Text> : null}
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.dim}>No takes recorded yet.</Text>
          <Text style={styles.dim}>
            Practice a video and they'll land here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>
              {entries.length} take{entries.length === 1 ? "" : "s"}
            </Text>
            <View style={styles.summaryStats}>
              <Stat label="Vivid" value={avg(entries, "vividnessScore")} />
              <StatDivider />
              <Stat label="Warm" value={avg(entries, "warmthScore")} />
              <StatDivider />
              <Stat label="Engaging" value={avg(entries, "engagementScore")} />
            </View>
          </View>

          {entries.map((e) => (
            <View key={e.id} style={styles.entry}>
              <View style={styles.entryHead}>
                <Text style={styles.entryDate}>{formatDate(e.createdAt)}</Text>
                <View style={styles.entryScores}>
                  <ChipScore label="V" value={e.feedback.vividnessScore} />
                  <ChipScore label="W" value={e.feedback.warmthScore} />
                  <ChipScore label="E" value={e.feedback.engagementScore} />
                </View>
              </View>
              <Text style={styles.entryTitle} numberOfLines={1}>
                {e.video.title}
              </Text>
              {e.improvConstraint ? (
                <Text style={styles.entryConstraint}>
                  ↳ {e.improvConstraint}
                </Text>
              ) : null}
              <Text style={styles.entryBody} numberOfLines={3}>
                "{e.userTranscript}"
              </Text>
              <Text style={styles.entryMeta}>
                {e.metrics.wordsPerMinute} wpm
                {e.metrics.fillerCount
                  ? ` · ${e.metrics.fillerCount} filler${e.metrics.fillerCount === 1 ? "" : "s"}`
                  : ""}
                {e.metrics.prosody && e.metrics.prosody.voicedFrames > 0
                  ? ` · range ${e.metrics.prosody.pitchRangeSemitones} st`
                  : ""}
              </Text>
              <Text style={styles.entryCoachLabel}>COACH</Text>
              <Text style={styles.entryCoach}>{e.feedback.overall}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function avg(entries: JournalEntry[], key: keyof JournalEntry["feedback"]) {
  if (entries.length === 0) return 0;
  return Math.round(
    entries.reduce((s, e) => s + Number(e.feedback[key] ?? 0), 0) /
      entries.length,
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatDivider() {
  return <View style={styles.statDivider} />;
}

function ChipScore({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.chipScore}>
      <Text style={styles.chipScoreLabel}>{label}</Text>
      <Text style={styles.chipScoreValue}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 60,
    gap: 16,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  empty: {
    padding: 24,
    alignItems: "center",
    gap: 4,
  },
  dim: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.inkDim,
  },
  bot: {
    padding: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  botHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  botBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: theme.colors.accentMuted,
  },
  botBadgeText: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.accent,
    letterSpacing: 1,
    fontWeight: "700",
  },
  botTitle: {
    fontFamily: theme.font.display,
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.ink,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  chipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
    fontWeight: "500",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: theme.font.body,
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
  },
  sendBtn: {
    width: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: {
    fontFamily: theme.font.body,
    fontSize: 20,
    color: theme.colors.onAccent,
    fontWeight: "700",
    marginTop: -2,
  },
  botAnswer: {
    padding: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  botAnswerText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.ink,
  },
  botErr: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.danger,
  },
  summary: {
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  summaryLabel: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1.3,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontFamily: theme.font.display,
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.ink,
  },
  statLabel: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: theme.colors.border,
  },
  entry: {
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  entryHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryDate: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.inkFaint,
  },
  entryScores: {
    flexDirection: "row",
    gap: 6,
  },
  chipScore: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
  },
  chipScoreLabel: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    color: theme.colors.inkFaint,
    fontWeight: "700",
  },
  chipScoreValue: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.ink,
    fontWeight: "700",
  },
  entryTitle: {
    fontFamily: theme.font.display,
    fontSize: 16,
    color: theme.colors.ink,
    fontWeight: "600",
    marginTop: 2,
  },
  entryConstraint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.accent,
    fontStyle: "italic",
  },
  entryBody: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.inkDim,
    fontStyle: "italic",
    marginTop: 4,
  },
  entryMeta: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.inkFaint,
    marginTop: 4,
  },
  entryCoachLabel: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1.2,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 6,
  },
  entryCoach: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.ink,
  },
});
