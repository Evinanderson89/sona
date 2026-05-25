import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import type {
  Breakthrough,
  JournalEntry,
  UserProfile,
} from "@sona/shared";
import { Button } from "../../components/Button";
import { Thumbnail } from "../../components/Thumbnail";
import { theme } from "../../lib/theme";
import { api, type BudgetStatus } from "../../lib/api";
import {
  getProfile,
  listBreakthroughs,
  listJournal,
} from "../../lib/storage";
import { exitDemoMode, isDemoActive } from "../../lib/demo";

interface Clip {
  url: string;
  title: string;
  duration: string;
}

const LIBRARY: Clip[] = [
  { url: "https://www.youtube.com/watch?v=ZXsQAXx_ao0", title: "Shia LaBeouf — Just Do It", duration: "1:00" },
  { url: "https://www.youtube.com/watch?v=owGykVbfgUE", title: "Old Spice — The Man", duration: "0:32" },
  { url: "https://www.youtube.com/watch?v=_OBlgSz8sSM", title: "Charlie Bit My Finger", duration: "0:56" },
  { url: "https://www.youtube.com/watch?v=txqiwrbYGrs", title: "David After Dentist", duration: "1:58" },
  { url: "https://www.youtube.com/watch?v=wKbU8B-QVZk", title: "I Can't Believe You've Done This", duration: "0:23" },
  { url: "https://www.youtube.com/watch?v=2zfqw8nhUwA", title: "Apple — 1984", duration: "1:01" },
  { url: "https://www.youtube.com/watch?v=KgzQuE1pR1w", title: "Bill Hicks — It's Just A Ride", duration: "2:30" },
  { url: "https://www.youtube.com/watch?v=wupToqz1e2g", title: "Carl Sagan — Pale Blue Dot", duration: "3:30" },
];

const DRIFT_THRESHOLD = 10;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [breakthroughs, setBreakthroughs] = useState<Breakthrough[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);

  const load = useCallback(async () => {
    const [p, j, b, d] = await Promise.all([
      getProfile(),
      listJournal(),
      listBreakthroughs(),
      isDemoActive(),
    ]);
    setProfile(p);
    setJournal(j);
    setBreakthroughs(b);
    setDemo(d);
    setLoading(false);
    if (!p) router.replace("/calibrate");
    // Budget call is best-effort — API might be down
    api.budget().then(setBudget).catch(() => {});
  }, []);

  async function leaveDemo() {
    await exitDemoMode();
    setDemo(false);
    router.replace("/calibrate");
  }

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  if (loading || !profile) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const driftReady = profile.takesSinceCalibration >= DRIFT_THRESHOLD;
  const todayClip = pickClipForDate(new Date());
  const todayCue = profile.growthEdges[0] ?? "Open with an image, not a fact.";

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: theme.colors.bg }}
    >
      {demo ? (
        <View style={styles.demoBar}>
          <View style={styles.demoBarLeft}>
            <View style={styles.demoDot} />
            <Text style={styles.demoLabel}>DEMO MODE</Text>
            <Text style={styles.demoSub}>Pre-loaded sample data</Text>
          </View>
          <Pressable onPress={leaveDemo} style={styles.demoExit}>
            <Text style={styles.demoExitText}>Exit →</Text>
          </Pressable>
        </View>
      ) : null}

      {/* IDENTITY */}
      <View style={styles.identity}>
        <Text style={styles.eyebrow}>YOUR VOICE</Text>
        <Text style={styles.archetype}>{profile.archetypeName}</Text>
        <Text style={styles.archetypeDesc}>{profile.archetypeDescription}</Text>

        <View style={styles.stats}>
          <Stat label="Takes" value={String(journal.length)} />
          <StatDivider />
          <Stat label="Version" value={`v${profile.version}`} />
          <StatDivider />
          <Stat
            label="Last"
            value={shortDate(profile.lastCalibratedAt)}
          />
        </View>

        <View style={styles.ctaRow}>
          <View style={{ flex: 1 }}>
            <Button
              size="lg"
              title="Practice now"
              onPress={() =>
                router.push({
                  pathname: "/practice",
                  params: { url: todayClip.url, constraint: todayCue },
                })
              }
            />
          </View>
        </View>
      </View>

      {driftReady ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/calibrate",
              params: { recalibrate: "1" },
            })
          }
          style={({ hovered, pressed }: any) => [
            styles.drift,
            (hovered || pressed) && { borderColor: theme.colors.accent },
          ]}
        >
          <View style={styles.driftDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.driftLabel}>Recalibrate</Text>
            <Text style={styles.driftBody}>
              Ten takes in. Let's hear who you are now.
            </Text>
          </View>
          <Text style={styles.driftArrow}>→</Text>
        </Pressable>
      ) : null}

      {/* SONIC FOOTPRINT */}
      <Section title="Sonic footprint" subtitle="Your defaults from the last calibration">
        <View style={styles.footprint}>
          <Gauge
            label="Warmth"
            value={warmthScoreFromJournal(journal)}
            max={10}
            unit="/10"
            zone={[6, 10]}
          />
          <Gauge
            label="Pacing"
            value={profile.baseline.wordsPerMinute}
            max={220}
            unit="wpm"
            zone={[130, 150]}
          />
          <Gauge
            label="Expressiveness"
            value={profile.baseline.pitchRangeSemitones}
            max={16}
            unit="st"
            zone={[6, 14]}
          />
        </View>
      </Section>

      {/* TODAY */}
      <Section title="Today" subtitle="One thing to work on">
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/practice",
              params: { url: todayClip.url, constraint: todayCue },
            })
          }
          style={({ hovered, pressed }: any) => [
            styles.dailyCard,
            (hovered || pressed) && { borderColor: theme.colors.borderHi },
          ]}
        >
          <View style={styles.dailyTop}>
            <Thumbnail url={todayClip.url} duration={todayClip.duration} size="md" />
            <View style={styles.dailyMeta}>
              <Text style={styles.dailyEyebrow}>FEATURED CLIP</Text>
              <Text style={styles.dailyTitle}>{todayClip.title}</Text>
            </View>
          </View>
          <View style={styles.missionBox}>
            <Text style={styles.missionEyebrow}>MICRO-MISSION</Text>
            <Text style={styles.missionText}>{todayCue}</Text>
          </View>
        </Pressable>
      </Section>

      {/* BREAKTHROUGHS */}
      <Section title="Breakthroughs" subtitle="Recent moves the system noticed">
        {breakthroughs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Nothing yet. Record a take and small wins will land here.
            </Text>
          </View>
        ) : (
          <View style={styles.btList}>
            {breakthroughs.slice(0, 5).map((b, i) => (
              <View key={b.takeId + b.type} style={[styles.bt, i === 0 && styles.btFirst]}>
                <View style={styles.btTagRow}>
                  <View style={styles.btTag}>
                    <Text style={styles.btTagText}>{b.type}</Text>
                  </View>
                  <Text style={styles.btDate}>{formatDate(b.createdAt)}</Text>
                </View>
                <Text style={styles.btTitle}>{b.title}</Text>
                <Text style={styles.btDetail}>{b.detail}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* LIBRARY */}
      <Section title="Library" subtitle="All clips">
        <View style={styles.libList}>
          {LIBRARY.map((c) => (
            <Pressable
              key={c.url}
              onPress={() =>
                router.push({ pathname: "/practice", params: { url: c.url } })
              }
              style={({ hovered, pressed }: any) => [
                styles.libRow,
                (hovered || pressed) && { backgroundColor: theme.colors.surfaceAlt },
              ]}
            >
              <Thumbnail url={c.url} duration={c.duration} size="sm" />
              <Text style={styles.libTitle} numberOfLines={1}>
                {c.title}
              </Text>
              <Text style={styles.libArrow}>→</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="Working on" subtitle="Tailored from your last calibration">
        {profile.growthEdges.map((edge, i) => (
          <View key={i} style={styles.edge}>
            <Text style={styles.edgeNum}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={styles.edgeText}>{edge}</Text>
          </View>
        ))}
      </Section>

      {budget ? <BudgetFooter budget={budget} /> : null}
    </ScrollView>
  );
}

function BudgetFooter({ budget }: { budget: BudgetStatus }) {
  const pct = Math.min(1, budget.spent / Math.max(budget.cap, 0.01));
  const warn = pct >= 0.8;
  const blocked = !budget.ok;
  return (
    <View style={styles.budget}>
      <View style={styles.budgetHead}>
        <Text style={styles.budgetLabel}>API SPEND</Text>
        <Text
          style={[
            styles.budgetValue,
            blocked && { color: theme.colors.danger },
            !blocked && warn && { color: theme.colors.accent },
          ]}
        >
          ${budget.spent.toFixed(2)} / ${budget.cap.toFixed(2)}
        </Text>
      </View>
      <View style={styles.budgetTrack}>
        <View
          style={[
            styles.budgetFill,
            {
              width: `${pct * 100}%`,
              backgroundColor: blocked
                ? theme.colors.danger
                : warn
                  ? theme.colors.accent
                  : theme.colors.inkFaint,
            },
          ]}
        />
      </View>
      <Text style={styles.budgetMeta}>
        {budget.callCount} calls · {blocked ? "cap reached, API refusing new calls" : `$${budget.remaining.toFixed(2)} remaining`}
      </Text>
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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

function Gauge({
  label,
  value,
  max,
  unit,
  zone,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  zone?: [number, number];
}) {
  const pct = Math.min(1, Math.max(0, value / max));
  const zoneStart = zone ? (zone[0] / max) * 100 : null;
  const zoneEnd = zone ? (zone[1] / max) * 100 : null;
  const inZone = zone ? value >= zone[0] && value <= zone[1] : false;
  return (
    <View style={styles.gauge}>
      <View style={styles.gaugeHead}>
        <Text style={styles.gaugeLabel}>{label}</Text>
        <Text style={styles.gaugeValue}>
          {Number.isFinite(value) ? value.toFixed(value < 10 ? 1 : 0) : "—"}
          <Text style={styles.gaugeUnit}>{unit}</Text>
        </Text>
      </View>
      <View style={styles.gaugeTrack}>
        {zoneStart !== null && zoneEnd !== null ? (
          <View
            style={[
              styles.gaugeZone,
              {
                left: `${zoneStart}%`,
                width: `${zoneEnd - zoneStart}%`,
              },
            ]}
          />
        ) : null}
        <View style={[styles.gaugeFill, { width: `${pct * 100}%` }]} />
        <View style={[styles.gaugePointer, { left: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.gaugeMeta}>
        {zone ? (inZone ? "in zone" : `zone ${zone[0]}–${zone[1]} ${unit}`) : ""}
      </Text>
    </View>
  );
}

function warmthScoreFromJournal(journal: JournalEntry[]) {
  if (journal.length === 0) return 0;
  const last = journal.slice(0, 5);
  return (
    last.reduce((sum, e) => sum + (e.feedback.warmthScore || 0), 0) / last.length
  );
}

function pickClipForDate(d: Date): Clip {
  const dayKey = Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
  return LIBRARY[dayKey % LIBRARY.length];
}

function shortDate(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "today";
  if (diff === 1) return "1d ago";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

function formatDate(iso: string) {
  return shortDate(iso);
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
  },
  container: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 80,
    gap: 32,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  demoBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  demoBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  demoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  demoLabel: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.accent,
    letterSpacing: 1.3,
  },
  demoSub: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.inkDim,
  },
  demoExit: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  demoExitText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.ink,
  },
  identity: {
    gap: 14,
  },
  eyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.inkFaint,
    letterSpacing: 1.5,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  archetype: {
    fontFamily: theme.font.display,
    color: theme.colors.ink,
    fontSize: 40,
    fontWeight: "600",
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  archetypeDesc: {
    fontFamily: theme.font.body,
    color: theme.colors.inkDim,
    fontSize: 15,
    lineHeight: 23,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    marginTop: 6,
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
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  drift: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.accentMuted,
  },
  driftDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  driftLabel: {
    fontFamily: theme.font.display,
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.ink,
  },
  driftBody: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.inkDim,
    marginTop: 2,
  },
  driftArrow: {
    fontFamily: theme.font.body,
    fontSize: 18,
    color: theme.colors.accent,
  },
  section: {
    gap: 14,
  },
  sectionHead: {
    gap: 2,
  },
  sectionTitle: {
    fontFamily: theme.font.display,
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  sectionSub: {
    fontFamily: theme.font.body,
    color: theme.colors.inkDim,
    fontSize: 13,
  },
  footprint: {
    gap: 16,
    padding: 18,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gauge: {
    gap: 6,
  },
  gaugeHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  gaugeLabel: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
    fontWeight: "500",
  },
  gaugeValue: {
    fontFamily: theme.font.mono,
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.ink,
    letterSpacing: -0.3,
  },
  gaugeUnit: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.inkFaint,
    fontWeight: "500",
    marginLeft: 2,
  },
  gaugeTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceHi,
    position: "relative",
    overflow: "hidden",
  },
  gaugeZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(91, 227, 159, 0.18)",
  },
  gaugeFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.accent,
    opacity: 0.7,
  },
  gaugePointer: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 2,
    backgroundColor: theme.colors.ink,
    marginLeft: -1,
    borderRadius: 1,
  },
  gaugeMeta: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  dailyCard: {
    overflow: "hidden",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dailyTop: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  dailyMeta: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  dailyEyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1.2,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  dailyTitle: {
    fontFamily: theme.font.display,
    fontSize: 17,
    color: theme.colors.ink,
    fontWeight: "600",
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  missionBox: {
    padding: 16,
    backgroundColor: theme.colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  missionEyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.accent,
    letterSpacing: 1.3,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  missionText: {
    fontFamily: theme.font.display,
    fontSize: 16,
    color: theme.colors.ink,
    fontWeight: "500",
    lineHeight: 22,
  },
  empty: {
    padding: 22,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: theme.font.body,
    color: theme.colors.inkDim,
    fontSize: 14,
    textAlign: "center",
  },
  btList: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  bt: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 6,
  },
  btFirst: {
    borderTopWidth: 0,
  },
  btTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  btTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: theme.colors.accentMuted,
  },
  btTagText: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.accent,
    letterSpacing: 0.8,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  btDate: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
  },
  btTitle: {
    fontFamily: theme.font.display,
    fontSize: 16,
    color: theme.colors.ink,
    fontWeight: "600",
  },
  btDetail: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.inkDim,
    lineHeight: 19,
  },
  libList: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  libRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  libTitle: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
    fontWeight: "500",
  },
  libArrow: {
    fontFamily: theme.font.body,
    fontSize: 16,
    color: theme.colors.inkFaint,
  },
  edge: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  edgeNum: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: "600",
    width: 24,
    paddingTop: 2,
  },
  edgeText: {
    flex: 1,
    fontFamily: theme.font.display,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.ink,
    fontWeight: "500",
  },
  budget: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: 8,
  },
  budgetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetLabel: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.inkFaint,
    letterSpacing: 1.3,
    fontWeight: "600",
  },
  budgetValue: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    color: theme.colors.inkDim,
    fontWeight: "600",
  },
  budgetTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  budgetFill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
  },
  budgetMeta: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.inkFaint,
  },
});
