import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, typography, numeric } from "@/src/theme";
import { api, TrendsResponse } from "@/src/api";
import { BaselineChart } from "@/src/components/Chart";

type Range = "2w" | "6w" | "3m";
const RANGES: { key: Range; label: string }[] = [
  { key: "2w", label: "2 weeks" },
  { key: "6w", label: "6 weeks" },
  { key: "3m", label: "3 months" },
];

export default function TrendsScreen() {
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<Range>("6w");
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const res = await api.trends(r);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const chartWidth = width - spacing.lg * 4;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="trends-screen">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Patterns</Text>
        <Text style={styles.title}>Trends</Text>

        <View style={styles.rangeRow} testID="range-selector">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <TouchableOpacity
                key={r.key}
                testID={`range-${r.key}`}
                onPress={() => setRange(r.key)}
                style={[styles.rangePill, active && styles.rangePillActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.rangeLabel, active && styles.rangeLabelActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!data || loading ? (
          <ActivityIndicator color={colors.teal} style={{ marginTop: 80 }} />
        ) : (
          <>
            <Section title="Wearable">
              {data.metrics
                .filter((m) => m.kind === "wearable")
                .map((m) => (
                  <MetricRow key={m.key} m={m} width={chartWidth} />
                ))}
            </Section>

            <Section title="Biomarkers">
              {data.metrics
                .filter((m) => m.kind === "biomarker")
                .map((m) => (
                  <MetricRow key={m.key} m={m} width={chartWidth} />
                ))}
            </Section>

            <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={{ gap: spacing.md }}>{children}</View>
  </View>
);

const MetricRow: React.FC<{ m: TrendsResponse["metrics"][number]; width: number }> = ({
  m,
  width,
}) => {
  if (m.series.length === 0) {
    return null;
  }
  const latest = m.series[m.series.length - 1].value;
  const inBand = latest >= m.band.low && latest <= m.band.high;
  const tone = inBand ? colors.good : latest < m.band.low ? colors.alert : colors.teal;
  return (
    <View style={styles.metricCard} testID={`metric-${m.key}`}>
      <View style={styles.metricHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metricLabel}>{m.label}</Text>
          <Text style={styles.metricBand}>
            band {fmt(m.band.low)}–{fmt(m.band.high)} {m.unit}
          </Text>
        </View>
        <Text style={[styles.metricValue, { color: tone }]}>
          {fmt(latest)} <Text style={styles.metricUnit}>{m.unit}</Text>
        </Text>
      </View>
      <BaselineChart
        width={width}
        height={84}
        series={m.series}
        band={m.band}
        showAxis={false}
        showDots={false}
      />
    </View>
  );
};

function fmt(n: number) {
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  eyebrow: { ...typography.label, color: colors.teal },
  title: { ...typography.h1, fontSize: 30 },
  rangeRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
  },
  rangePillActive: { borderColor: colors.teal, backgroundColor: colors.tealMuted },
  rangeLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  rangeLabelActive: { color: colors.teal },
  scrollContent: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.label },
  metricCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  metricLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  metricBand: { ...numeric, fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  metricValue: { ...numeric, fontSize: 22, fontWeight: "500" },
  metricUnit: { fontSize: 10, color: colors.textTertiary, fontWeight: "400" },
});
