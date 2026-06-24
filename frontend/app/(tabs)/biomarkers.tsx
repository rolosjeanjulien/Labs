import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Switch,
  Image,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radii, spacing, typography, numeric } from "@/src/theme";
import { api, BiomarkerResponse } from "@/src/api";
import { BaselineChart } from "@/src/components/Chart";

const DEVICE_IMAGE = require("../../assets/device.png");

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

  // External Labs biomarker device — Bluetooth simulation
  const [bleState, setBleState] = useState<"idle" | "connecting" | "connected">("idle");
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0); // 0..1
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (m: Metric) => {
    setLoading(true);
    try {
      const r = await api.biomarker(m);
      setData(r);
    } finally {
      setLoading(false);
    }
  }, []);

  // Pulse animation for the LED while connecting / running
  useEffect(() => {
    if (bleState === "connecting" || running) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(0);
    }
  }, [bleState, running, pulse]);

  const onConnect = useCallback(() => {
    if (bleState === "connected" || bleState === "connecting") return;
    setBleState("connecting");
    setTimeout(() => setBleState("connected"), 1600);
  }, [bleState]);

  const onRun = useCallback(() => {
    if (bleState !== "connected" || running) return;
    setRunning(true);
    setRunProgress(0);
    const start = Date.now();
    const total = 4200; // ~4.2s simulated run
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / total);
      setRunProgress(p);
      if (p >= 1) {
        clearInterval(tick);
        setRunning(false);
        setLastRunAt(new Date());
        load(metric);
      }
    }, 80);
  }, [bleState, running, metric, load]);

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
            {/* Labs biomarker device — Bluetooth instrument */}
            <View style={styles.deviceCard} testID="device-card">
              <View style={styles.deviceImageWrap}>
                <Image
                  source={DEVICE_IMAGE}
                  style={styles.deviceImage}
                  resizeMode="contain"
                />
                {/* LED indicator */}
                <View style={styles.ledWrap}>
                  <Text style={styles.ledLabel}>
                    {running
                      ? "PROCESSING"
                      : bleState === "connecting"
                      ? "PAIRING"
                      : bleState === "connected"
                      ? "READY"
                      : "OFFLINE"}
                  </Text>
                  <Animated.View
                    style={[
                      styles.ledDot,
                      {
                        backgroundColor:
                          running
                            ? colors.alert
                            : bleState === "connected"
                            ? colors.good
                            : bleState === "connecting"
                            ? colors.watch
                            : colors.textTertiary,
                        opacity:
                          bleState === "connecting" || running
                            ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] })
                            : 1,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.deviceMeta}>
                <View>
                  <Text style={styles.deviceName}>Labs Biomarker Device</Text>
                  <Text style={styles.deviceSerial}>
                    Saliva · Capillary · Urine · BLE 5.2
                  </Text>
                </View>
                {lastRunAt && (
                  <View style={styles.deviceLastRun}>
                    <Text style={styles.deviceLastRunLabel}>last run</Text>
                    <Text style={styles.deviceLastRunValue}>
                      {lastRunAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                )}
              </View>

              {/* Run progress bar */}
              {running && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${runProgress * 100}%` }]} />
                </View>
              )}

              {/* Connect + Run buttons */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  testID="device-connect"
                  onPress={onConnect}
                  disabled={bleState === "connecting" || bleState === "connected"}
                  activeOpacity={0.85}
                  style={[
                    styles.btn,
                    styles.btnConnect,
                    bleState === "connected" && styles.btnConnected,
                  ]}
                >
                  {bleState === "connecting" ? (
                    <ActivityIndicator size="small" color={colors.teal} />
                  ) : (
                    <Ionicons
                      name="bluetooth"
                      size={16}
                      color={bleState === "connected" ? colors.good : colors.teal}
                    />
                  )}
                  <Text
                    style={[
                      styles.btnLabel,
                      { color: bleState === "connected" ? colors.good : colors.teal },
                    ]}
                  >
                    {bleState === "connected"
                      ? "Connected"
                      : bleState === "connecting"
                      ? "Pairing…"
                      : "Connect"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="device-run"
                  onPress={onRun}
                  disabled={bleState !== "connected" || running}
                  activeOpacity={0.85}
                  style={[
                    styles.btn,
                    styles.btnRun,
                    (bleState !== "connected" || running) && styles.btnRunDisabled,
                  ]}
                >
                  {running ? (
                    <ActivityIndicator size="small" color={colors.bg} />
                  ) : (
                    <Ionicons name="play" size={14} color={colors.bg} />
                  )}
                  <Text style={styles.btnRunLabel}>
                    {running ? `Running ${Math.round(runProgress * 100)}%` : "Run"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

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
  deviceCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: "hidden",
  },
  deviceImageWrap: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    backgroundColor: "#0a0c10",
    borderColor: colors.border,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  deviceImage: {
    width: "108%",
    height: "108%",
  },
  ledWrap: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  ledLabel: { ...numeric, fontSize: 9, letterSpacing: 1.5, color: colors.textSecondary },
  ledDot: { width: 7, height: 7, borderRadius: 4 },
  deviceMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  deviceName: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  deviceSerial: { ...numeric, fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  deviceLastRun: { alignItems: "flex-end" },
  deviceLastRunLabel: { ...typography.label, fontSize: 9 },
  deviceLastRunValue: { ...numeric, fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  progressTrack: {
    height: 3,
    backgroundColor: colors.borderStrong,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.teal,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  btnConnect: {
    backgroundColor: colors.tealFaint,
    borderColor: colors.teal,
  },
  btnConnected: {
    backgroundColor: "transparent",
    borderColor: colors.good,
  },
  btnLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  btnRun: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  btnRunDisabled: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
  },
  btnRunLabel: { color: colors.bg, fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
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
