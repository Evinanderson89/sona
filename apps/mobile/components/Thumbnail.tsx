import { Image, View, StyleSheet, Text } from "react-native";
import { extractYouTubeId } from "@sona/shared";
import { theme } from "../lib/theme";

interface Props {
  url: string;
  duration?: string;
  size?: "sm" | "md" | "lg";
}

export function Thumbnail({ url, duration, size = "md" }: Props) {
  const id = extractYouTubeId(url);
  const src = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  const { w, h } = sizeFor(size);

  return (
    <View style={[styles.wrap, { width: w, height: h }]}>
      {src ? (
        <Image source={{ uri: src }} style={styles.image} resizeMode="cover" />
      ) : null}
      {duration ? (
        <View style={styles.duration}>
          <Text style={styles.durationText}>{duration}</Text>
        </View>
      ) : null}
    </View>
  );
}

function sizeFor(size: "sm" | "md" | "lg") {
  switch (size) {
    case "sm":
      return { w: 84, h: 56 };
    case "lg":
      return { w: 168, h: 112 };
    case "md":
    default:
      return { w: 120, h: 80 };
  }
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.videoBg,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  duration: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  durationText: {
    color: theme.colors.ink,
    fontSize: 10,
    fontWeight: "600",
    fontFamily: theme.font.mono,
    letterSpacing: 0.3,
  },
});
