import { Platform } from "react-native";

export const theme = {
  colors: {
    bg: "#08090B",
    surface: "#101115",
    surfaceAlt: "#16171C",
    surfaceHi: "#1B1D24",
    border: "#22242C",
    borderHi: "#30333D",
    ink: "#F5F6F8",
    inkDim: "#A4A7B0",
    inkFaint: "#5A5D67",
    accent: "#5DD4FF",
    accentDeep: "#2EB2E6",
    accentMuted: "rgba(93, 212, 255, 0.12)",
    danger: "#FF5A6A",
    good: "#5BE39F",
    onAccent: "#06121C",
    videoBg: "#000000",
    // Compatibility aliases for older screens
    rule: "#22242C",
    ruleSoft: "#1B1D24",
    text: "#F5F6F8",
    textDim: "#A4A7B0",
    accentDim: "#2EB2E6",
    onInk: "#F5F6F8",
  },
  radius: {
    none: 0,
    sm: 8,
    md: 12,
    lg: 18,
  },
  font: {
    display: Platform.select({
      ios: "System",
      android: "sans-serif-medium",
      default:
        'Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    })!,
    body: Platform.select({
      ios: "System",
      android: "sans-serif",
      default:
        'Inter, "SF Pro Text", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    })!,
    mono: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default:
        'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
    })!,
  },
  spacing: (n: number) => n * 4,
} as const;

export type Theme = typeof theme;
