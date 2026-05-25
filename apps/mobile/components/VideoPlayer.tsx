import { Platform, View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../lib/theme";

interface Props {
  videoId: string;
}

export function VideoPlayer({ videoId }: Props) {
  const src = `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`;
  if (Platform.OS === "web") {
    return (
      <View style={styles.wrap}>
        <iframe
          src={src}
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            border: 0,
            borderRadius: theme.radius.md,
          }}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <WebView
        style={styles.webview}
        source={{ uri: src }}
        allowsFullscreenVideo
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    aspectRatio: 16 / 9,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    borderRadius: theme.radius.md,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
  },
});
