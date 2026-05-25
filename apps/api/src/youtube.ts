import { YoutubeTranscript } from "youtube-transcript";
import { extractYouTubeId } from "@sona/shared";

export interface FetchedVideo {
  videoId: string;
  title: string;
  channel?: string;
  durationSeconds?: number;
  transcript: string;
}

interface OEmbed {
  title: string;
  author_name?: string;
}

async function fetchOEmbed(videoId: string): Promise<OEmbed | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    if (!res.ok) return null;
    return (await res.json()) as OEmbed;
  } catch {
    return null;
  }
}

export async function fetchVideo(url: string): Promise<FetchedVideo> {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error("Could not extract a YouTube video ID from that URL.");
  }

  const [transcriptParts, oembed] = await Promise.all([
    YoutubeTranscript.fetchTranscript(videoId).catch(() => []),
    fetchOEmbed(videoId),
  ]);

  const transcript = transcriptParts
    .map((p) => p.text.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");

  const durationSeconds = transcriptParts.length
    ? Math.round(
        (transcriptParts[transcriptParts.length - 1].offset +
          transcriptParts[transcriptParts.length - 1].duration) /
          1000,
      )
    : undefined;

  return {
    videoId,
    title: oembed?.title ?? "Untitled video",
    channel: oembed?.author_name,
    durationSeconds,
    transcript,
  };
}

export function truncateForPrompt(text: string, maxChars = 6000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}
