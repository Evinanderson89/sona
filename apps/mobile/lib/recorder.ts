import { Platform } from "react-native";
import { Audio } from "expo-av";
import type { ProsodyMetrics } from "@sona/shared";
import { startProsodyTracker, type ProsodyTracker } from "./prosody";

export interface RecordingResult {
  transcript: string;
  durationSeconds: number;
  pauseSegments: Array<{ startSec: number; endSec: number }>;
  prosody?: ProsodyMetrics;
}

export interface ActiveRecording {
  stop: () => Promise<RecordingResult>;
  cancel: () => Promise<void>;
}

interface WebSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

function getWebSpeechCtor():
  | (new () => WebSpeechRecognition)
  | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export async function startRecording(): Promise<ActiveRecording> {
  if (Platform.OS === "web") return startWebRecording();
  return startNativeRecording();
}

async function startWebRecording(): Promise<ActiveRecording> {
  const Ctor = getWebSpeechCtor();
  if (!Ctor) {
    throw new Error(
      "This browser doesn't support speech recognition. Try Chrome or Safari.",
    );
  }

  // Kick off pitch tracking in parallel. It also asks for mic permission;
  // the browser will treat both requests as one prompt.
  let prosodyTracker: ProsodyTracker | null = null;
  try {
    prosodyTracker = await startProsodyTracker();
  } catch (err) {
    console.warn("Sona tracker failed to start, continuing without it:", err);
  }

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;

  let transcript = "";
  let lastResultAt = performance.now();
  const pauseSegments: Array<{ startSec: number; endSec: number }> = [];
  const start = performance.now();

  recognition.onresult = (event: any) => {
    const now = performance.now();
    const gap = (now - lastResultAt) / 1000;
    if (gap > 1.0) {
      pauseSegments.push({
        startSec: (lastResultAt - start) / 1000,
        endSec: (now - start) / 1000,
      });
    }
    lastResultAt = now;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + " ";
    }
  };

  let endedResolver: (() => void) | null = null;
  const endedPromise = new Promise<void>((resolve) => {
    endedResolver = resolve;
  });
  recognition.onend = () => endedResolver?.();
  recognition.onerror = () => endedResolver?.();

  recognition.start();

  return {
    async stop() {
      recognition.stop();
      await endedPromise;
      const durationSeconds = (performance.now() - start) / 1000;
      const prosody = prosodyTracker?.stop();
      return {
        transcript: transcript.trim(),
        durationSeconds,
        pauseSegments,
        prosody,
      };
    },
    async cancel() {
      recognition.abort();
      prosodyTracker?.cancel();
      await endedPromise.catch(() => {});
    },
  };
}

async function startNativeRecording(): Promise<ActiveRecording> {
  const { granted } = await Audio.requestPermissionsAsync();
  if (!granted) {
    throw new Error("Microphone permission denied.");
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  await recording.startAsync();
  const start = Date.now();

  return {
    async stop() {
      await recording.stopAndUnloadAsync();
      const durationSeconds = (Date.now() - start) / 1000;
      return {
        transcript:
          "(Native on-device transcription is wired in a follow-up step. Type or paste what you said for now.)",
        durationSeconds,
        pauseSegments: [],
      };
    },
    async cancel() {
      try {
        await recording.stopAndUnloadAsync();
      } catch {}
    },
  };
}
