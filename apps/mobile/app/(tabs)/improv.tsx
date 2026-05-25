import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { extractYouTubeId, type ImprovPrompt } from "@sona/shared";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { theme } from "../../lib/theme";
import { api } from "../../lib/api";
import { pushImprov, recentImprov } from "../../lib/storage";

export default function ImprovScreen() {
  const [prompt, setPrompt] = useState<ImprovPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");

  async function roll() {
    setLoading(true);
    try {
      const recent = await recentImprov();
      const result = await api.improv({ recentConstraints: recent });
      await pushImprov(result.constraint);
      setPrompt(result);
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    roll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go() {
    const id = extractYouTubeId(url);
    if (!id || !prompt) {
      showError("Need a YouTube URL and a constraint first.");
      return;
    }
    router.push({
      pathname: "/practice",
      params: { url, constraint: prompt.constraint },
    });
  }

  function showError(msg: string) {
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert("Hmm", msg);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.subtitle}>
        A curveball. You'll describe a video while honoring this constraint.
      </Text>

      <Card style={{ borderColor: theme.colors.accent }}>
        {loading ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : prompt ? (
          <>
            <Text style={styles.label}>Constraint</Text>
            <Text style={styles.constraint}>{prompt.constraint}</Text>
            <Text style={styles.rationale}>{prompt.rationale}</Text>
          </>
        ) : (
          <Text style={styles.dim}>No constraint yet.</Text>
        )}
        <View style={{ height: 12 }} />
        <Button title="Reroll" variant="secondary" onPress={roll} loading={loading} />
      </Card>

      <Card>
        <Text style={styles.label}>Video to describe</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="Paste a YouTube URL"
          placeholderTextColor={theme.colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <View style={{ height: 12 }} />
        <Button title="Go" onPress={go} disabled={!url || !prompt} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  subtitle: {
    color: theme.colors.textDim,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    color: theme.colors.textDim,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  constraint: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
  },
  rationale: {
    color: theme.colors.textDim,
    fontSize: 13,
    marginTop: 8,
    fontStyle: "italic",
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    fontSize: 16,
  },
  dim: {
    color: theme.colors.textDim,
    fontSize: 14,
  },
});
