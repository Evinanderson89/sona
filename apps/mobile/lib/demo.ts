import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Breakthrough,
  JournalEntry,
  UserProfile,
} from "@sona/shared";
import {
  appendJournal,
  pushBreakthroughs,
  saveProfile,
  clearJournal,
} from "./storage";

const DEMO_FLAG_KEY = "sona.demo.v1";

export async function isDemoActive(): Promise<boolean> {
  return (await AsyncStorage.getItem(DEMO_FLAG_KEY)) === "1";
}

export async function enterDemoMode(): Promise<void> {
  // Seed in order: clear → profile → journal → breakthroughs.
  await clearJournal();
  await AsyncStorage.removeItem("sona.breakthroughs.v1");

  await saveProfile(DEMO_PROFILE);

  for (const entry of DEMO_JOURNAL) {
    await appendJournal(entry);
  }

  await pushBreakthroughs(DEMO_BREAKTHROUGHS);
  await AsyncStorage.setItem(DEMO_FLAG_KEY, "1");
}

export async function exitDemoMode(): Promise<void> {
  await AsyncStorage.multiRemove([
    DEMO_FLAG_KEY,
    "sona.profile.v1",
    "sona.journal.v1",
    "sona.breakthroughs.v1",
    "sona.improv.recent.v1",
    "sona.mission.v1",
  ]);
}

// ---- seed data ----

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

const DEMO_PROFILE: UserProfile = {
  version: 2,
  archetypeName: "The Searching Reporter",
  archetypeDescription:
    "You're the person at the dinner table who notices what other people don't say. Your sentences land with curiosity rather than conclusion, and you favor specific details over big claims. The voice stays steady — almost a little too steady — but the listener leans in because they trust you.",
  growthEdges: [
    "Trust the silence after a question — let it pull people forward.",
    "Risk one image per minute, even if it feels strange.",
    "Let your voice ride up at the end of a discovery.",
  ],
  baseline: {
    pitchMedianHz: 148,
    pitchRangeSemitones: 5.2,
    pitchVariation: 0.05,
    loudnessDynamics: 0.18,
    wordsPerMinute: 142,
    fillerRate: 2.8,
  },
  takesSinceCalibration: 7,
  lastCalibratedAt: ago(12),
  history: [
    {
      version: 2,
      archetypeName: "The Searching Reporter",
      baseline: {
        pitchMedianHz: 148,
        pitchRangeSemitones: 5.2,
        pitchVariation: 0.05,
        loudnessDynamics: 0.18,
        wordsPerMinute: 142,
        fillerRate: 2.8,
      },
      createdAt: ago(12),
    },
    {
      version: 1,
      archetypeName: "The Steady Witness",
      baseline: {
        pitchMedianHz: 144,
        pitchRangeSemitones: 3.8,
        pitchVariation: 0.04,
        loudnessDynamics: 0.12,
        wordsPerMinute: 138,
        fillerRate: 4.1,
      },
      createdAt: ago(34),
    },
  ],
};

const SHIA = {
  videoId: "ZXsQAXx_ao0",
  url: "https://www.youtube.com/watch?v=ZXsQAXx_ao0",
  title: "Shia LaBeouf — Just Do It",
};
const OLD_SPICE = {
  videoId: "owGykVbfgUE",
  url: "https://www.youtube.com/watch?v=owGykVbfgUE",
  title: "Old Spice — The Man Your Man Could Smell Like",
};
const SAGAN = {
  videoId: "wupToqz1e2g",
  url: "https://www.youtube.com/watch?v=wupToqz1e2g",
  title: "Carl Sagan — Pale Blue Dot",
};
const HICKS = {
  videoId: "KgzQuE1pR1w",
  url: "https://www.youtube.com/watch?v=KgzQuE1pR1w",
  title: "Bill Hicks — It's Just A Ride",
};
const DAVID = {
  videoId: "txqiwrbYGrs",
  url: "https://www.youtube.com/watch?v=txqiwrbYGrs",
  title: "David After Dentist",
};
const APPLE = {
  videoId: "2zfqw8nhUwA",
  url: "https://www.youtube.com/watch?v=2zfqw8nhUwA",
  title: "Apple — 1984",
};

const DEMO_JOURNAL: JournalEntry[] = [
  {
    id: "demo-7",
    createdAt: ago(0),
    video: SAGAN,
    improvConstraint: "Trust the silence after a question — let it pull people forward.",
    userTranscript:
      "A pale dot. Floating in the dark. Everyone you ever loved, every fight that mattered, every quiet morning — all stacked on this one suspended grain. It almost dares you to take yourself seriously.",
    metrics: {
      durationSeconds: 41,
      wordCount: 44,
      wordsPerMinute: 64,
      fillerCount: 0,
      fillerWords: [],
      longestPauseSeconds: 2.1,
      pauseRatio: 0.22,
      prosody: {
        pitchMedianHz: 151,
        pitchMinHz: 122,
        pitchMaxHz: 192,
        pitchRangeSemitones: 7.8,
        pitchVariation: 0.08,
        endingContour: -0.4,
        loudnessMedian: 0.09,
        loudnessMin: 0.03,
        loudnessMax: 0.31,
        loudnessDynamics: 0.28,
        voicedFrames: 580,
        totalFrames: 820,
      },
    },
    feedback: {
      overall:
        "This is the most you've leaned into image so far. The phrase 'suspended grain' did real work. You also let the silences sit, which is exactly what this clip rewards.",
      strengths: [
        "Concrete imagery led the description.",
        "Two pauses over 1.8 seconds — earned and held.",
      ],
      growthEdges: [
        "The final sentence dropped on 'seriously' — try lifting it instead.",
        "One more sensory beat (texture, color) would deepen the picture.",
      ],
      vividnessScore: 9,
      warmthScore: 8,
      engagementScore: 9,
      rewrite:
        "A pale dot. Suspended in the dark. Everyone you ever loved — every fight that mattered, every quiet morning — stacked on this one bright grain. It almost dares you to take yourself seriously.",
      rewriteNotes: "Tighter rhythm; one extra adjective on 'grain' to make the image land.",
    },
  },
  {
    id: "demo-6",
    createdAt: ago(1),
    video: HICKS,
    improvConstraint: "Risk one image per minute, even if it feels strange.",
    userTranscript:
      "Bill Hicks pacing a stage, talking about reality like it's a movie set. He flips this idea that life is just a ride — terrifying, sure, but you can change the channel any time. He's not selling comfort, he's selling agency.",
    metrics: {
      durationSeconds: 38,
      wordCount: 52,
      wordsPerMinute: 82,
      fillerCount: 1,
      fillerWords: ["like"],
      longestPauseSeconds: 1.4,
      pauseRatio: 0.14,
      prosody: {
        pitchMedianHz: 146,
        pitchMinHz: 124,
        pitchMaxHz: 178,
        pitchRangeSemitones: 6.0,
        pitchVariation: 0.07,
        endingContour: -0.2,
        loudnessMedian: 0.11,
        loudnessMin: 0.05,
        loudnessMax: 0.28,
        loudnessDynamics: 0.23,
        voicedFrames: 530,
        totalFrames: 760,
      },
    },
    feedback: {
      overall:
        "Strong frame — 'a movie set' is the kind of metaphor your old self wouldn't have reached for. Word choice carried this one. Voice was steady but stayed in a comfortable middle.",
      strengths: ["Movie-set metaphor lands the abstract idea.", "Final beat lands clean: 'agency' not 'comfort.'"],
      growthEdges: [
        "Almost no pitch travel — try lifting on the discovery moments.",
        "Pace was uniform. Slow down on 'change the channel.'",
      ],
      vividnessScore: 7,
      warmthScore: 7,
      engagementScore: 8,
      rewrite:
        "Bill Hicks pacing a stage, treating reality like a movie set. Life is just a ride, he says — terrifying, sure, but you can change the channel any time you want. He's not selling comfort. He's selling agency.",
      rewriteNotes: "Broke the long second sentence so the punchline can breathe.",
    },
  },
  {
    id: "demo-5",
    createdAt: ago(2),
    video: APPLE,
    userTranscript:
      "Grey hallway, grey faces, all marching the same direction. And then this woman in color sprinting through with a hammer. It's an ad but it feels like a manifesto.",
    metrics: {
      durationSeconds: 32,
      wordCount: 34,
      wordsPerMinute: 64,
      fillerCount: 0,
      fillerWords: [],
      longestPauseSeconds: 1.6,
      pauseRatio: 0.18,
      prosody: {
        pitchMedianHz: 149,
        pitchMinHz: 130,
        pitchMaxHz: 175,
        pitchRangeSemitones: 5.0,
        pitchVariation: 0.06,
        endingContour: -0.3,
        loudnessMedian: 0.1,
        loudnessMin: 0.04,
        loudnessMax: 0.22,
        loudnessDynamics: 0.18,
        voicedFrames: 410,
        totalFrames: 620,
      },
    },
    feedback: {
      overall:
        "Crisp. The repetition of 'grey' did exactly what it needed to. The contrast hit when the color showed up.",
      strengths: ["Repetition for cumulative effect.", "Tight ending — no extra words."],
      growthEdges: [
        "Could push the woman-in-color moment with one more sensory detail.",
        "Voice was even throughout — you can risk more here.",
      ],
      vividnessScore: 8,
      warmthScore: 6,
      engagementScore: 8,
      rewrite:
        "Grey hallway, grey faces, all marching the same direction. Then a woman in red, sprinting, hammer raised. It's an ad. It feels like a manifesto.",
      rewriteNotes: "Specified the color; broke the last sentence in two for impact.",
    },
  },
  {
    id: "demo-4",
    createdAt: ago(4),
    video: OLD_SPICE,
    userTranscript:
      "A guy is on a boat, then a horse, then holding diamonds. The whole point is that he's offering you a fantasy you can almost touch. It's funny because the smell is the joke and the deflection at the same time.",
    metrics: {
      durationSeconds: 39,
      wordCount: 48,
      wordsPerMinute: 74,
      fillerCount: 2,
      fillerWords: ["like", "you know"],
      longestPauseSeconds: 0.9,
      pauseRatio: 0.08,
      prosody: {
        pitchMedianHz: 147,
        pitchMinHz: 128,
        pitchMaxHz: 168,
        pitchRangeSemitones: 4.2,
        pitchVariation: 0.05,
        endingContour: -0.5,
        loudnessMedian: 0.09,
        loudnessMin: 0.05,
        loudnessMax: 0.16,
        loudnessDynamics: 0.11,
        voicedFrames: 470,
        totalFrames: 700,
      },
    },
    feedback: {
      overall:
        "You found the joke ('deflection at the same time') but voice and pace stayed flat. The reading was smarter than the delivery.",
      strengths: ["Got to the meta-layer: it's a joke about the joke.", "Specific objects: boat, horse, diamonds."],
      growthEdges: [
        "Two fillers in 39s — you don't need them; the silence is fine.",
        "Try a real pitch jump when you hit 'horse' or 'diamonds.'",
      ],
      vividnessScore: 7,
      warmthScore: 5,
      engagementScore: 6,
      rewrite:
        "A guy is on a boat. Then a horse. Then he's holding diamonds. He's offering you a fantasy you can almost touch — and the smell is both the joke and the deflection.",
      rewriteNotes: "Short sentences for the rhythm; tighter close.",
    },
  },
  {
    id: "demo-3",
    createdAt: ago(6),
    video: SHIA,
    userTranscript:
      "Shia LaBeouf in front of a green screen, basically yelling motivation at you. It's so over the top that you can't tell if it's parody or sincere, and that's exactly why it works.",
    metrics: {
      durationSeconds: 28,
      wordCount: 36,
      wordsPerMinute: 77,
      fillerCount: 1,
      fillerWords: ["basically"],
      longestPauseSeconds: 1.1,
      pauseRatio: 0.09,
      prosody: {
        pitchMedianHz: 145,
        pitchMinHz: 128,
        pitchMaxHz: 164,
        pitchRangeSemitones: 3.5,
        pitchVariation: 0.04,
        endingContour: -0.6,
        loudnessMedian: 0.1,
        loudnessMin: 0.06,
        loudnessMax: 0.15,
        loudnessDynamics: 0.09,
        voicedFrames: 360,
        totalFrames: 540,
      },
    },
    feedback: {
      overall:
        "You nailed why it works — 'can't tell if it's parody or sincere' is the actual hook. But you described an intense clip in a notably un-intense voice.",
      strengths: ["Identified the tonal ambiguity.", "Concise — no filler."],
      growthEdges: [
        "If the clip is loud, you can borrow some of the loudness.",
        "End with a pause, not a drop.",
      ],
      vividnessScore: 6,
      warmthScore: 5,
      engagementScore: 6,
      rewrite:
        "Shia LaBeouf in front of a green screen — yelling motivation. It's so over the top you can't tell if it's parody or sincere. That's exactly why it works.",
      rewriteNotes: "Three sentences instead of one for breath; pulled 'yelling' forward.",
    },
  },
  {
    id: "demo-2",
    createdAt: ago(8),
    video: DAVID,
    userTranscript:
      "A small kid in the back of a car after dental surgery. Big eyes. He keeps asking, 'is this real life?' He's not joking — he's actually checking. That's what makes it tender.",
    metrics: {
      durationSeconds: 31,
      wordCount: 38,
      wordsPerMinute: 74,
      fillerCount: 0,
      fillerWords: [],
      longestPauseSeconds: 1.3,
      pauseRatio: 0.12,
      prosody: {
        pitchMedianHz: 147,
        pitchMinHz: 130,
        pitchMaxHz: 166,
        pitchRangeSemitones: 4.0,
        pitchVariation: 0.05,
        endingContour: -0.3,
        loudnessMedian: 0.09,
        loudnessMin: 0.05,
        loudnessMax: 0.17,
        loudnessDynamics: 0.12,
        voicedFrames: 400,
        totalFrames: 590,
      },
    },
    feedback: {
      overall:
        "Strongest moment: 'he's actually checking.' That observation is what separates description from analysis. Warmth was real here.",
      strengths: ["You read the kid's interiority, not just the surface.", "Short final sentence carried the moral."],
      growthEdges: [
        "Could risk a softer voice — match the tenderness you're describing.",
        "One more sensory beat (his voice, the seat-belt, light) would seal it.",
      ],
      vividnessScore: 7,
      warmthScore: 8,
      engagementScore: 7,
      rewrite:
        "A small kid in the back of a car after dental surgery. Big eyes. He keeps asking 'is this real life?' — not joking. Actually checking. That's what makes it tender.",
      rewriteNotes: "Em-dashes and fragments for the quieter cadence the content wants.",
    },
  },
  {
    id: "demo-1",
    createdAt: ago(11),
    video: HICKS,
    userTranscript:
      "Hicks is talking about how everything is just a ride, like a fairground ride. Some people get scared, some people have fun. There's no inherent meaning, you just choose what kind of rider you are.",
    metrics: {
      durationSeconds: 35,
      wordCount: 42,
      wordsPerMinute: 72,
      fillerCount: 2,
      fillerWords: ["like", "just"],
      longestPauseSeconds: 0.8,
      pauseRatio: 0.07,
      prosody: {
        pitchMedianHz: 144,
        pitchMinHz: 128,
        pitchMaxHz: 161,
        pitchRangeSemitones: 3.6,
        pitchVariation: 0.04,
        endingContour: -0.5,
        loudnessMedian: 0.09,
        loudnessMin: 0.05,
        loudnessMax: 0.14,
        loudnessDynamics: 0.09,
        voicedFrames: 460,
        totalFrames: 670,
      },
    },
    feedback: {
      overall:
        "Accurate but flat. You hit the message but the voice stayed in a polite middle the whole time — and that undersells material that wants commitment.",
      strengths: ["Captured the core image: a ride.", "Pulled out the choice frame at the end."],
      growthEdges: [
        "Pitch range under 4 semitones — try lifting on 'have fun.'",
        "Cut 'just' and 'like' — they buffer your voice from the listener.",
      ],
      vividnessScore: 5,
      warmthScore: 5,
      engagementScore: 5,
      rewrite:
        "Hicks is talking about how everything is a ride. A fairground ride. Some people scream. Some people throw their hands up. There's no inherent meaning — you choose what kind of rider you are.",
      rewriteNotes: "Specific verbs (scream, throw their hands up) replace 'have fun.'",
    },
  },
];

const DEMO_BREAKTHROUGHS: Breakthrough[] = [
  {
    takeId: "demo-7",
    type: "range",
    title: "Pitch travel",
    detail:
      "Your range opened from 5.2 st (baseline) to 7.8 st today. That's a real lift — you let the voice move.",
    createdAt: ago(0),
  },
  {
    takeId: "demo-7",
    type: "variation",
    title: "Expressiveness shift",
    detail:
      "Your pitch variation rose from 5% to 8%. Less monotone, more sung.",
    createdAt: ago(0),
  },
  {
    takeId: "demo-5",
    type: "warmth",
    title: "Resonance shift",
    detail: "Coach scored you 8/10 on warmth. Your delivery landed with emotional weight.",
    createdAt: ago(2),
  },
  {
    takeId: "demo-4",
    type: "fillers",
    title: "Cleaner cadence",
    detail: "Filler rate dropped to 1.4/min (baseline 2.8). You cut the noise.",
    createdAt: ago(4),
  },
];
