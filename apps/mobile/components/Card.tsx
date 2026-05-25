import { View, StyleSheet, ViewStyle } from "react-native";
import { theme } from "../lib/theme";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "raised" | "outline";
}

export function Card({ children, style, variant = "default" }: Props) {
  return (
    <View
      style={[
        styles.card,
        variant === "default" && styles.default,
        variant === "raised" && styles.raised,
        variant === "outline" && styles.outline,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  default: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  raised: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
  },
  outline: {
    backgroundColor: "transparent",
    borderColor: theme.colors.border,
  },
});
