import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radii, spacing, typography, numeric, verdictColor, verdictLabel } from "@/src/theme";
import { api, TodayResponse } from "@/src/api";
import { Sparkline } from "@/src/components/Chart";

export default function TodayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.today();
      setData(r);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <ActivityIndicator color={colors.teal} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const date = new Date(data.date);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const verdict = data.readiness.verdict;
  const vColor = verdictColor(verdict);
  const history = data.readiness.history.map((h) => h.value);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="today-screen">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{dateStr}</Text>
            <Text style={styles.title}>Today</Text>
          </View>
          <View style={styles.brandMark}>
            <Text style={styles.brandText}>LABS</Text>
          </View>
        </View>

        {/* Readiness hero */}
        <View style={styles.heroCard} testID="readiness-hero">
          <Text style={styles.heroLabel}>Readiness</Text>

          {/* Personal baseline band behind the score */}
          <View style={styles.heroValueWrap}>
            <View style={styles.heroBand} />
            <Text style={styles.heroValue} testID="readiness-score">
              {data.readiness.score}
            </Text>
            <Text style={styles.heroOutOf}>/ 100</Text>
          </View>

          <View style={[styles.verdictPill, { borderColor: vColor }]} testID="readiness-verdict">
            <View style={[styles.verdictDot, { backgroundColor: vColor }]} />
            <Text style={[styles.verdictLabel, { color: vColor }]}>
              {verdictLabel(verdict)}
            </Text>
          </View>

          <View style={styles.sparkRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sparkLabel}>21d trend</Text>
              <Text style={styles.sparkRange}>
                band {data.readiness.band.low}–{data.readiness.band.high}
              </Text>
            </View>
            <Sparkline
              width={Math.min(180, width * 0.45)}
              height={42}
              series={history}
              band={data.readiness.band}
            />
          </View>
        </View>

        {/* Invie narrative */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.invieCard}
          testID="today-invie-card"
          onPress={() => router.push("/(tabs)/invie")}
        >
          <View style={styles.invieHeader}>
            <View style={styles.invieIcon}>
              <View style={styles.invieIconDot} />
            </View>
            <Text style={styles.invieName}>Invie</Text>
            <Text style={styles.invieConfidence}>
              {Math.round(data.readiness.confidence * 100)}%
            </Text>
          </View>
          <Text style={styles.invieNarrative} testID="invie-narrative">
            {data.narrative}
          </Text>
          <View style={styles.invieFooter}>
            <Text style={styles.invieFooterText}>Ask Invie</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.teal} />
          </View>
        </TouchableOpacity>

        {/* Signals 2x2 */}
        <Text style={styles.sectionLabel}>Signals</Text>
        <View style={styles.signalsGrid}>
          {data.signals.map((s) => (
            <SignalCard key={s.key} signal={s} />
          ))}
        </View>

        {/* Drivers list */}
        <Text style={styles.sectionLabel}>Drivers</Text>
        <View style={styles.driversCard}>
          {data.drivers.map((d, i) => (
            <View
              key={d.label}
              style={[
                styles.driverRow,
                i !== data.drivers.length - 1 && styles.driverRowDivider,
              ]}
            >
              <Text style={styles.driverLabel}>{d.label}</Text>
              <View style={styles.driverRight}>
                <Text style={styles.driverValue}>
                  {fmt(d.value)}{" "}
                  <Text style={styles.driverUnit}>{d.unit}</Text>
                </Text>
                <View
                  style={[
                    styles.posDot,
                    {
                      backgroundColor:
                        d.position === "in"
                          ? colors.good
                          : d.position === "below"
                          ? colors.alert
                          : colors.teal,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Sovereignty footer */}
        <View style={styles.sovFooter} testID="sovereignty-footer">
          <View style={styles.sovDot} />
          <Text style={styles.sovText}>
            Stored in {data.sovereignty.region} · Yours · {dateStr}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function fmt(n: number) {
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

const SignalCard: React.FC<{ signal: TodayResponse["signals"][number] }> = ({ signal }) => {
  const positive = signal.delta_pct >= 0;
  const inBand =
    signal.value >= signal.band.low && signal.value <= signal.band.high;
  const tone = inBand ? colors.good : signal.value < signal.band.low ? colors.alert : colors.teal;
  const arrow = positive ? "↑" : "↓";
  return (
    <View style={styles.signalCard} testID={`signal-${signal.key}`}>
      <Text style={styles.signalLabel}>{signal.label}</Text>
      <View style={styles.signalValueRow}>
        <Text style={styles.signalValue}>{fmt(signal.value)}</Text>
        <Text style={styles.signalUnit}>{signal.unit}</Text>
      </View>
      {/* baseline band mini bar */}
      <BaselineBar value={signal.value} band={signal.band} />
      <View style={styles.signalDeltaRow}>
        <Text style={[styles.signalDelta, { color: tone }]}>
          {arrow} {Math.abs(signal.delta_pct).toFixed(1)}%
        </Text>
        <Text style={styles.signalBaselineText}>
          vs {fmt(signal.band.mid)}
        </Text>
      </View>
    </View>
  );
};

const BaselineBar: React.FC<{ value: number; band: { low: number; mid: number; high: number } }> = ({
  value,
  band,
}) => {
  // 0..1 position of value in [low - 0.5*range, high + 0.5*range]
  const range = band.high - band.low || 1;
  const lo = band.low - range * 0.3;
  const hi = band.high + range * 0.3;
  const total = hi - lo || 1;
  const valuePos = Math.max(0, Math.min(1, (value - lo) / total));
  const bandStart = Math.max(0, Math.min(1, (band.low - lo) / total));
  const bandEnd = Math.max(0, Math.min(1, (band.high - lo) / total));
  return (
    <View style={styles.bbWrap}>
      <View style={styles.bbTrack} />
      <View
        style={[
          styles.bbBand,
          {
            left: `${bandStart * 100}%`,
            width: `${(bandEnd - bandStart) * 100}%`,
          },
        ]}
      />
      <View style={[styles.bbMarker, { left: `${valuePos * 100}%` }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.alert, padding: 24, textAlign: "center" },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.xs,
  },
  eyebrow: { ...typography.label, color: colors.textSecondary, marginBottom: 2 },
  title: { ...typography.h1, fontSize: 32 },
  brandMark: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  brandText: { ...numeric, fontSize: 11, letterSpacing: 4, color: colors.teal },
  heroCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroLabel: { ...typography.label },
  heroValueWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    minHeight: 110,
  },
  heroBand: {
    position: "absolute",
    left: -4,
    right: 80,
    top: 18,
    bottom: 8,
    backgroundColor: colors.tealFaint,
    borderRadius: 8,
    borderColor: colors.tealMuted,
    borderWidth: 1,
  },
  heroValue: { ...typography.metricHero },
  heroOutOf: {
    ...numeric,
    fontSize: 18,
    color: colors.textTertiary,
    marginBottom: 14,
  },
  verdictPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  verdictDot: { width: 6, height: 6, borderRadius: 4 },
  verdictLabel: { fontWeight: "700", fontSize: 13, letterSpacing: 0.5 },
  sparkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  sparkLabel: { ...typography.label, marginBottom: 2 },
  sparkRange: { ...numeric, fontSize: 11, color: colors.textTertiary },
  invieCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderLeftColor: colors.teal,
    borderLeftWidth: 2,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  invieHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  invieIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.tealMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  invieIconDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal },
  invieName: { color: colors.textPrimary, fontWeight: "600", fontSize: 14, letterSpacing: 0.3 },
  invieConfidence: {
    marginLeft: "auto",
    ...numeric,
    fontSize: 11,
    color: colors.textTertiary,
  },
  invieNarrative: { ...typography.body, color: colors.textPrimary, fontSize: 15.5, lineHeight: 23 },
  invieFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  invieFooterText: { color: colors.teal, fontWeight: "600", fontSize: 13 },
  sectionLabel: { ...typography.label, marginTop: spacing.sm, marginBottom: -spacing.sm },
  signalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  signalCard: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: 6,
  },
  signalLabel: { ...typography.label, fontSize: 10 },
  signalValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  signalValue: { ...typography.metricCard, fontSize: 24 },
  signalUnit: { ...numeric, fontSize: 11, color: colors.textTertiary, marginBottom: 4 },
  signalDeltaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  signalDelta: { ...numeric, fontSize: 12, fontWeight: "600" },
  signalBaselineText: { ...numeric, fontSize: 10, color: colors.textTertiary },
  bbWrap: { height: 6, justifyContent: "center", marginTop: 4 },
  bbTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  bbBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: colors.tealMuted,
    borderRadius: 3,
  },
  bbMarker: {
    position: "absolute",
    width: 2,
    height: 10,
    marginLeft: -1,
    top: -2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
  },
  driversCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
  },
  driverRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  driverRowDivider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  driverLabel: { color: colors.textSecondary, fontSize: 14 },
  driverRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  driverValue: { ...typography.metricCard, fontSize: 16 },
  driverUnit: { ...numeric, fontSize: 11, color: colors.textTertiary, fontWeight: "400" },
  posDot: { width: 8, height: 8, borderRadius: 4 },
  sovFooter: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  sovDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.teal },
  sovText: { ...numeric, fontSize: 11, color: colors.textTertiary, letterSpacing: 0.5 },
});
