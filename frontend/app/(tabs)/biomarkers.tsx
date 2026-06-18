import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, typography, numeric } from "@/src/theme";
import { api, BiomarkerResponse } from "@/src/api";
import { BaselineChart } from "@/src/components/Chart";

type Metric = "siga" | "cortisol" | "testosterone" | "creatinine";

const METRICS: { key: Metric; label: string }[] = [
  { key: "siga", label: "sIgA" },
  { key: "cortisol", label: "Cortisol" },
  { key: "testosterone", label: "Testosterone" },
  { key: "creatinine", label: "Creatinine" },
];

export default function BiomarkersScreen() {
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<Metric>("siga");
  const [data, setData] = useState<BiomarkerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [overlay, setOverlay] = useState(true);

  const load = useCallback(async (m: Metric) => {
    setLoading(true);
    try {
      const r = await api.biomarker(m);
      setData(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(metric);
  }, [metric, load]);

  const chartWidth = width - spacing.lg * 2;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="biomarkers-screen">
      {/* Header / metric tabs (sticky chrome) */}
      <View style={styles.headerWrap}>
        <Text style={styles.eyebrow}>Biomarker</Text>
        <Text style={styles.title}>{data?.label ?? "—"}</Text>
        <Text style={styles.subtitle}>{data?.subtitle ?? ""}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroller}
        >
          {METRICS.map((m) => {
            const active = m.key === metric;
            return (
              <TouchableOpacity
                key={m.key}
                testID={`biomarker-chip-${m.key}`}
                onPress={() => setMetric(m.key)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!data || loading ? (
          <ActivityIndicator color={colors.teal} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Latest value */}
            <View style={styles.latestCard} testID="biomarker-latest">
              <View style={styles.latestRow}>
                <View>
                  <Text style={styles.label}>Latest</Text>
                  <View style={styles.latestValueRow}>
                    <Text style={styles.latestValue}>{fmt(data.latest.value)}</Text>
                    <Text style={styles.latestUnit}>{data.unit}</Text>
                  </View>
                  <Text style={styles.latestDate}>
                    {new Date(data.latest.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <View style={styles.deltaCol}>
                  <Text style={styles.label}>vs. previous</Text>
                  <Text
                    style={[
                      styles.deltaValue,
                      {
                        color:
                          data.delta_pct > 0
                            ? colors.good
                            : data.delta_pct < 0
                            ? colors.alert
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    {data.delta_pct >= 0 ? "↑" : "↓"} {Math.abs(data.delta_pct).toFixed(1)}%
                  </Text>
                  <PositionPill position={data.position} />
                </View>
              </View>
              <View style={styles.bandRow}>
                <Text style={styles.bandLabel}>Personal band</Text>
                <Text style={styles.bandRange}>
                  {fmt(data.band.low)} – {fmt(data.band.high)} {data.unit}
                </Text>
              </View>
            </View>

            {/* Chart */}
            <View style={styles.chartCard} testID="biomarker-chart">
              <View style={styles.chartHeader}>
                <Text style={styles.label}>10-week timeline</Text>
                <View style={styles.overlayRow}>
                  <Text style={styles.overlayLabel}>Training load</Text>
                  <Switch
                    testID="overlay-toggle"
                    value={overlay}
                    onValueChange={setOverlay}
                    trackColor={{ false: colors.border, true: colors.tealDeep }}
                    thumbColor={overlay ? colors.teal : colors.textTertiary}
                    ios_backgroundColor={colors.border}
                  />
                </View>
              </View>
              <BaselineChart
                width={chartWidth - spacing.lg * 2}
                height={240}
                series={data.series}
                band={data.band}
                overlay={data.training_load}
                showOverlay={overlay}
              />
              <View style={styles.legendRow}>
                <Legend color={colors.teal} label={data.label} />
                <Legend color={colors.tealFaint} label="Personal band" filled />
                {overlay && <Legend color={colors.watch} label="Training load" dashed />}
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsCard}>
              <Stat label="Readings" value={String(data.series.length)} />
              <Stat label="Mid baseline" value={`${fmt(data.band.mid)} ${data.unit}`} />
              <Stat
                label="Range"
                value={`${fmt(Math.min(...data.series.map((s) => s.value)))} – ${fmt(
                  Math.max(...data.series.map((s) => s.value)),
                )}`}
              />
            </View>

            <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function fmt(n: number) {
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

const PositionPill: React.FC<{ position: "below" | "in" | "above" }> = ({ position }) => {
  const color =
    position === "in" ? colors.good : position === "below" ? colors.alert : colors.teal;
  const label = position === "in" ? "In band" : position === "below" ? "Below band" : "Above band";
  return (
    <View style={[styles.posPill, { borderColor: color }]}>
      <View style={[styles.posDot, { backgroundColor: color }]} />
      <Text style={[styles.posLabel, { color }]}>{label}</Text>
    </View>
  );
};

const Legend: React.FC<{ color: string; label: string; filled?: boolean; dashed?: boolean }> = ({
  color,
  label,
  filled,
  dashed,
}) => (
  <View style={styles.legendItem}>
    <View
      style={[
        styles.legendSwatch,
        filled ? { backgroundColor: color } : { borderColor: color, borderWidth: 1.5 },
        dashed && { borderStyle: "dashed" },
      ]}
    />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statCol}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 4,
  },
  eyebrow: { ...typography.label, color: colors.teal },
  title: { ...typography.h1, fontSize: 30 },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  chipScroller: { marginTop: spacing.md, marginHorizontal: -spacing.lg },
  chipRow: { paddingHorizontal: spacing.lg, gap: 8, height: 40 },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { borderColor: colors.teal, backgroundColor: colors.tealMuted },
  chipLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  chipLabelActive: { color: colors.teal },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 120,
  },
  latestCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
  },
  latestRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  latestValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 },
  latestValue: { ...typography.metricLarge, fontSize: 48 },
  latestUnit: { ...numeric, fontSize: 13, color: colors.textTertiary, marginBottom: 10 },
  latestDate: { ...numeric, fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  label: { ...typography.label, fontSize: 10 },
  deltaCol: { alignItems: "flex-end", gap: 6 },
  deltaValue: { ...numeric, fontSize: 18, fontWeight: "600" },
  bandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  bandLabel: { ...typography.label },
  bandRange: { ...numeric, fontSize: 13, color: colors.textPrimary },
  posPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  posDot: { width: 5, height: 5, borderRadius: 3 },
  posLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  chartCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overlayRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  overlayLabel: { ...numeric, fontSize: 11, color: colors.textSecondary },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 14, height: 3, borderRadius: 2 },
  legendLabel: { ...numeric, fontSize: 10, color: colors.textSecondary },
  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  statCol: { gap: 4 },
  statValue: { ...typography.metricCard, fontSize: 15 },
});
