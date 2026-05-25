import type {
  JournalEntry,
  UserProfile,
  Breakthrough,
} from "@sona/shared";

// Detects standout moments in a fresh take vs. the user's baseline.
// Returns 0-2 breakthroughs per take so the feed doesn't get spammy.
export function detectBreakthroughs(
  entry: JournalEntry,
  profile: UserProfile,
): Breakthrough[] {
  const out: Breakthrough[] = [];
  const m = entry.metrics;
  const p = m.prosody;
  const b = profile.baseline;

  // Pacing — entered the conversational sweet spot (130-150 wpm) when baseline was outside it
  const inZone = (n: number) => n >= 130 && n <= 150;
  if (inZone(m.wordsPerMinute) && !inZone(b.wordsPerMinute)) {
    out.push({
      takeId: entry.id,
      type: "pacing",
      title: "Pacing milestone",
      detail: `You landed at ${m.wordsPerMinute} wpm — inside the 130-150 conversational zone for the first time in your profile.`,
      createdAt: entry.createdAt,
    });
  }

  // Pitch range widened materially
  if (p && b.pitchRangeSemitones > 0) {
    const delta = p.pitchRangeSemitones - b.pitchRangeSemitones;
    if (delta >= 2) {
      out.push({
        takeId: entry.id,
        type: "range",
        title: "Pitch travel",
        detail: `Your range opened from ${b.pitchRangeSemitones.toFixed(1)} st (baseline) to ${p.pitchRangeSemitones.toFixed(1)} st today. That's a real lift — you let the voice move.`,
        createdAt: entry.createdAt,
      });
    }
  }

  // Expressiveness — pitch variation jumped
  if (p && b.pitchVariation > 0) {
    const delta = p.pitchVariation - b.pitchVariation;
    if (delta >= 0.02) {
      out.push({
        takeId: entry.id,
        type: "variation",
        title: "Expressiveness shift",
        detail: `Your pitch variation rose from ${(b.pitchVariation * 100).toFixed(0)}% to ${(p.pitchVariation * 100).toFixed(0)}%. Less monotone, more sung.`,
        createdAt: entry.createdAt,
      });
    }
  }

  // Warmth — Claude scored you noticeably warmer than your average
  if (entry.feedback.warmthScore >= 8) {
    out.push({
      takeId: entry.id,
      type: "warmth",
      title: "Resonance shift",
      detail: `Coach scored you ${entry.feedback.warmthScore}/10 on warmth. Your delivery landed with emotional weight.`,
      createdAt: entry.createdAt,
    });
  }

  // Filler reduction
  const baseFillerRate = b.fillerRate;
  const takeFillerRate = m.fillerCount / Math.max(m.durationSeconds / 60, 0.1);
  if (baseFillerRate >= 2 && takeFillerRate <= baseFillerRate / 2) {
    out.push({
      takeId: entry.id,
      type: "fillers",
      title: "Cleaner cadence",
      detail: `Filler rate dropped to ${takeFillerRate.toFixed(1)}/min (baseline ${baseFillerRate.toFixed(1)}). You cut the noise.`,
      createdAt: entry.createdAt,
    });
  }

  // Loudness dynamics — used more emphasis than usual
  if (p && b.loudnessDynamics > 0) {
    const delta = p.loudnessDynamics - b.loudnessDynamics;
    if (delta >= 0.08) {
      out.push({
        takeId: entry.id,
        type: "dynamics",
        title: "Volume shape",
        detail: `You used a wider loudness range — emphasis showed up where it usually doesn't.`,
        createdAt: entry.createdAt,
      });
    }
  }

  // Limit to 2 per take, prioritizing voice metrics over text scores.
  const order: Record<string, number> = {
    range: 1,
    variation: 2,
    pacing: 3,
    dynamics: 4,
    fillers: 5,
    warmth: 6,
  };
  out.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
  return out.slice(0, 2);
}
