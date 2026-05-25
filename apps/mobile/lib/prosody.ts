import { YIN } from "pitchfinder";
import type { ProsodyMetrics } from "@sona/shared";

const SAMPLE_INTERVAL_MS = 50;
const FFT_SIZE = 2048;
const MIN_VOICED_PITCH = 60;
const MAX_VOICED_PITCH = 500;

interface Sample {
  t: number; // seconds from start
  pitch: number | null;
  rms: number;
}

export interface ProsodyTracker {
  stop: () => ProsodyMetrics;
  cancel: () => void;
}

export async function startProsodyTracker(): Promise<ProsodyTracker> {
  const AudioCtor =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtor) {
    throw new Error("This browser doesn't expose AudioContext.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioCtor();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  source.connect(analyser);

  const detect = YIN({ sampleRate: ctx.sampleRate, threshold: 0.1 });
  const buffer = new Float32Array(analyser.fftSize);
  const samples: Sample[] = [];
  const start = performance.now();

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buffer);
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) sumSquares += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSquares / buffer.length);
    let pitch: number | null = null;
    if (rms > 0.01) {
      const detected = detect(buffer);
      if (
        detected !== null &&
        detected !== undefined &&
        detected >= MIN_VOICED_PITCH &&
        detected <= MAX_VOICED_PITCH
      ) {
        pitch = detected;
      }
    }
    samples.push({
      t: (performance.now() - start) / 1000,
      pitch,
      rms,
    });
  }, SAMPLE_INTERVAL_MS);

  async function teardown() {
    clearInterval(timer);
    try {
      source.disconnect();
    } catch {}
    try {
      await ctx.close();
    } catch {}
    for (const track of stream.getTracks()) track.stop();
  }

  return {
    stop() {
      void teardown();
      return summarize(samples);
    },
    cancel() {
      void teardown();
    },
  };
}

function summarize(samples: Sample[]): ProsodyMetrics {
  const voiced = samples.filter((s) => s.pitch !== null) as Array<
    Sample & { pitch: number }
  >;
  const totalFrames = samples.length;
  const voicedFrames = voiced.length;

  if (voicedFrames === 0) {
    return emptyProsody(totalFrames);
  }

  const pitches = voiced.map((s) => s.pitch).sort((a, b) => a - b);
  const pitchMedianHz = pitches[Math.floor(pitches.length / 2)];
  const pitchMinHz = percentile(pitches, 0.1);
  const pitchMaxHz = percentile(pitches, 0.9);
  const pitchRangeSemitones =
    pitchMinHz > 0 ? 12 * Math.log2(pitchMaxHz / pitchMinHz) : 0;
  const meanPitch =
    pitches.reduce((a, b) => a + b, 0) / pitches.length;
  const variance =
    pitches.reduce((a, b) => a + (b - meanPitch) ** 2, 0) / pitches.length;
  const std = Math.sqrt(variance);
  const pitchVariation = meanPitch > 0 ? std / meanPitch : 0;

  // Ending contour: take the last second of voiced samples, fit a slope.
  const lastT = voiced[voiced.length - 1].t;
  const tail = voiced.filter((s) => s.t >= lastT - 1);
  let endingContour = 0;
  if (tail.length >= 3) {
    const xs = tail.map((s) => s.t);
    const ys = tail.map((s) => 12 * Math.log2(s.pitch / pitchMedianHz));
    const slope = leastSquaresSlope(xs, ys);
    // Normalize: ~1 semitone/sec slope is a clear contour.
    endingContour = clamp(slope, -2, 2) / 2;
  }

  const rmsAll = samples.map((s) => s.rms).sort((a, b) => a - b);
  const loudnessMedian = rmsAll[Math.floor(rmsAll.length / 2)];
  const loudnessMin = percentile(rmsAll, 0.1);
  const loudnessMax = percentile(rmsAll, 0.95);
  const loudnessDynamics = loudnessMax - loudnessMin;

  return {
    pitchMedianHz: round(pitchMedianHz, 1),
    pitchMinHz: round(pitchMinHz, 1),
    pitchMaxHz: round(pitchMaxHz, 1),
    pitchRangeSemitones: round(pitchRangeSemitones, 1),
    pitchVariation: round(pitchVariation, 3),
    endingContour: round(endingContour, 2),
    loudnessMedian: round(loudnessMedian, 3),
    loudnessMin: round(loudnessMin, 3),
    loudnessMax: round(loudnessMax, 3),
    loudnessDynamics: round(loudnessDynamics, 3),
    voicedFrames,
    totalFrames,
  };
}

function emptyProsody(totalFrames: number): ProsodyMetrics {
  return {
    pitchMedianHz: 0,
    pitchMinHz: 0,
    pitchMaxHz: 0,
    pitchRangeSemitones: 0,
    pitchVariation: 0,
    endingContour: 0,
    loudnessMedian: 0,
    loudnessMin: 0,
    loudnessMax: 0,
    loudnessDynamics: 0,
    voicedFrames: 0,
    totalFrames,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function leastSquaresSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number, places: number) {
  const m = 10 ** places;
  return Math.round(n * m) / m;
}
