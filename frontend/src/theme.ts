import { Platform, TextStyle } from "react-native";

// Restrained dark palette + teal accent. No gradients on white, no purple.
export const colors = {
  bg: "#050507",
  panel: "#0F1115",
  panelElevated: "#16191E",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
  teal: "#1FA98F",
  tealDeep: "#0C6E5C",
  tealMuted: "rgba(31,169,143,0.18)",
  tealFaint: "rgba(31,169,143,0.10)",
  good: "#1FA98F",
  watch: "#F59E0B",
  alert: "#E15252",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
  textTertiary: "#475569",
  textQuaternary: "#334155",
};

// System mono — keeps tabular numerals without bundling a Google Font.
export const mono = Platform.select<string>({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

// Premium sans on each platform.
export const sans = Platform.select<string>({
  ios: "System",
  android: "sans-serif",
  default: "System",
});

export const numeric: TextStyle = {
  fontFamily: mono,
  // @ts-ignore — iOS tabular numerals
  fontVariant: ["tabular-nums"],
};

export const radii = {
  card: 16,
  pill: 999,
  chip: 12,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const typography = {
  label: {
    fontFamily: sans,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textSecondary,
    textTransform: "uppercase" as const,
    fontWeight: "600" as const,
  },
  caption: {
    fontFamily: sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  body: {
    fontFamily: sans,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  bodySecondary: {
    fontFamily: sans,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  h2: {
    fontFamily: sans,
    fontSize: 22,
    fontWeight: "600" as const,
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: sans,
    fontSize: 28,
    fontWeight: "600" as const,
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  metricHero: {
    ...numeric,
    fontSize: 88,
    fontWeight: "300" as const,
    color: colors.textPrimary,
    letterSpacing: -3,
  },
  metricLarge: {
    ...numeric,
    fontSize: 40,
    fontWeight: "400" as const,
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  metricCard: {
    ...numeric,
    fontSize: 26,
    fontWeight: "500" as const,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  numericSmall: {
    ...numeric,
    fontSize: 13,
    color: colors.textSecondary,
  },
};

export const verdictColor = (verdict: string) => {
  if (verdict === "train_hard") return colors.good;
  if (verdict === "moderate") return colors.watch;
  return colors.alert;
};

export const verdictLabel = (verdict: string) => {
  if (verdict === "train_hard") return "Train hard";
  if (verdict === "moderate") return "Moderate";
  return "Recover";
};

export const positionColor = (position: string) => {
  if (position === "in") return colors.good;
  if (position === "above") return colors.teal;
  return colors.alert;
};
