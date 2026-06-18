import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radii, spacing, typography, numeric } from "@/src/theme";
import { api, VaultResponse } from "@/src/api";

const sourceIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  apple_health: "heart",
  labs_device: "flask",
  manual: "create",
};

export default function VaultScreen() {
  const [data, setData] = useState<VaultResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.vault());
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onExport = () => {
    setToast("Export queued — RGPD machine-readable JSON will be emailed.");
    setTimeout(() => setToast(null), 3500);
  };

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="vault-screen">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Data ownership</Text>
          <Text style={styles.title}>Vault</Text>
        </View>

        {/* Sovereignty hero */}
        <View style={styles.sovCard} testID="sovereignty-card">
          <View style={styles.sovIcon}>
            <Ionicons name="shield-checkmark" size={20} color={colors.teal} />
          </View>
          <Text style={styles.sovTitle}>
            Stored in {data.sovereignty.region}
          </Text>
          <Text style={styles.sovBody}>
            {data.sovereignty.host} · {data.sovereignty.compliance.join(" · ")} ·
            {" "}Owned by {data.sovereignty.owner}.
          </Text>
          <View style={styles.totalsRow}>
            <Total label="Wearable days" value={data.totals.daily_metrics} />
            <View style={styles.totalsDivider} />
            <Total label="Biomarker readings" value={data.totals.biomarker_readings} />
          </View>
        </View>

        {/* Sources list */}
        <Text style={styles.sectionLabel}>Connected sources</Text>
        <View style={styles.sourcesCard}>
          {data.sources.map((s, idx) => (
            <View
              key={s.id}
              style={[
                styles.sourceRow,
                idx !== data.sources.length - 1 && styles.sourceRowDivider,
              ]}
              testID={`source-${s.id}`}
            >
              <View style={styles.sourceIconWrap}>
                <Ionicons
                  name={sourceIcon[s.id] ?? "ellipse"}
                  size={18}
                  color={colors.teal}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceLabel}>{s.label}</Text>
                <Text style={styles.sourceMeta}>{s.metrics.join(" · ")}</Text>
                <Text style={styles.sourceSync}>
                  {s.last_sync
                    ? `synced ${relativeTime(s.last_sync)}`
                    : "no sync yet"}
                </Text>
              </View>
              <View style={[styles.statusPill, statusStyle(s.status)]}>
                <View style={[styles.statusDot, statusDotStyle(s.status)]} />
                <Text style={[styles.statusLabel, statusLabelStyle(s.status)]}>
                  {s.status}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <TouchableOpacity
          testID="vault-export"
          style={styles.exportBtn}
          onPress={onExport}
          activeOpacity={0.85}
        >
          <Ionicons name="download-outline" size={18} color={colors.teal} />
          <Text style={styles.exportLabel}>Export my data</Text>
        </TouchableOpacity>

        <View style={styles.rightsCard}>
          <Text style={styles.rightsTitle}>Your rights</Text>
          {[
            "Portability — full JSON / CSV export",
            "Visibility — every reading, every source, here",
            "Erasure — wipe your record on request",
          ].map((r) => (
            <View key={r} style={styles.rightsRow}>
              <View style={styles.rightsDot} />
              <Text style={styles.rightsText}>{r}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {toast && (
        <View style={styles.toast} testID="vault-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const Total: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={{ flex: 1 }}>
    <Text style={styles.totalValue}>{value}</Text>
    <Text style={styles.totalLabel}>{label}</Text>
  </View>
);

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const min = Math.round((now - t) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function statusStyle(s: string) {
  if (s === "connected") return { borderColor: colors.teal, backgroundColor: colors.tealMuted };
  return { borderColor: colors.border, backgroundColor: colors.panelElevated };
}
function statusDotStyle(s: string) {
  if (s === "connected") return { backgroundColor: colors.teal };
  return { backgroundColor: colors.textTertiary };
}
function statusLabelStyle(s: string) {
  if (s === "connected") return { color: colors.teal };
  return { color: colors.textSecondary };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 120,
  },
  header: { gap: 4, marginBottom: spacing.xs },
  eyebrow: { ...typography.label, color: colors.teal },
  title: { ...typography.h1, fontSize: 30 },
  sovCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sovIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  sovTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: "600", letterSpacing: -0.3 },
  sovBody: { ...typography.bodySecondary, fontSize: 13, lineHeight: 20 },
  totalsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  totalsDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  totalValue: { ...typography.metricCard, fontSize: 24 },
  totalLabel: { ...typography.label, fontSize: 10, marginTop: 2 },
  sectionLabel: { ...typography.label, marginTop: 4 },
  sourcesCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  sourceRowDivider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  sourceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  sourceMeta: { ...typography.caption, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  sourceSync: { ...numeric, fontSize: 10, color: colors.textTertiary, marginTop: 4 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 4 },
  statusLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.tealMuted,
    borderColor: colors.teal,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  exportLabel: { color: colors.teal, fontWeight: "700", fontSize: 14 },
  rightsCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rightsTitle: { ...typography.label, marginBottom: 6 },
  rightsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rightsDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.teal },
  rightsText: { ...typography.body, fontSize: 13.5, color: colors.textSecondary },
  toast: {
    position: "absolute",
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.panelElevated,
    borderColor: colors.teal,
    borderWidth: 1,
    borderRadius: radii.card,
  },
  toastText: { color: colors.textPrimary, fontSize: 13 },
});
