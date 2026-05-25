import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { theme } from "../lib/theme";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  size?: "md" | "lg";
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  size = "md",
}: Props) {
  const isDisabled = disabled || loading;
  const v = variants[variant];

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed, hovered }: any) => [
        styles.button,
        size === "lg" ? styles.lg : styles.md,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: isDisabled ? 0.45 : 1,
          transform: pressed ? [{ scale: 0.98 }] : [{ scale: 1 }],
        },
        hovered && !isDisabled
          ? { backgroundColor: v.hover ?? v.bg, borderColor: v.borderHover ?? v.border }
          : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.label, { color: v.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

interface Variant {
  bg: string;
  text: string;
  border: string;
  hover?: string;
  borderHover?: string;
}

const variants: Record<NonNullable<Props["variant"]>, Variant> = {
  primary: {
    bg: theme.colors.accent,
    text: theme.colors.onAccent,
    border: theme.colors.accent,
    hover: theme.colors.accentDeep,
    borderHover: theme.colors.accentDeep,
  },
  secondary: {
    bg: theme.colors.surfaceAlt,
    text: theme.colors.ink,
    border: theme.colors.border,
    hover: theme.colors.surfaceHi,
    borderHover: theme.colors.borderHi,
  },
  danger: {
    bg: theme.colors.danger,
    text: "#1F0306",
    border: theme.colors.danger,
  },
  ghost: {
    bg: "transparent",
    text: theme.colors.ink,
    border: theme.colors.border,
    hover: theme.colors.surface,
    borderHover: theme.colors.borderHi,
  },
};

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.1,
    fontFamily: theme.font.body,
  },
});
