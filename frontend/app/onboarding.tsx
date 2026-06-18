import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radii, spacing, typography, numeric } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api";

type Step = 0 | 1 | 2 | 3;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("Léa Moreau");
  const [sport, setSport] = useState("Trail running");
  const [goal, setGoal] = useState("100K Ultra · September");
  const [healthConnected, setHealthConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const finish = async () => {
    setSubmitting(true);
    try {
      await api.onboarding({
        name: name.trim() || "Athlete",
        sport: sport.trim() || "Trail running",
        goal: goal.trim() || "Performance",
        connect_apple_health: healthConnected,
      });
      await storage.setItem("labs.onboarded", true);
      router.replace("/(tabs)/today");
    } catch (e) {
      console.warn("onboarding failed", e);
      await storage.setItem("labs.onboarded", true);
      router.replace("/(tabs)/today");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* progress */}
          <View style={styles.progressRow} testID="onboarding-progress">
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          {step === 0 && (
            <View style={styles.stepWrap}>
              <Text style={styles.brandMark}>L A B S</Text>
              <Text style={styles.heroTitle}>
                Your biology,{"\n"}individually owned.
              </Text>
              <Text style={styles.heroBody}>
                Wearable signals and proprietary biomarkers in one longitudinal,
                personal record — interpreted by Invie.
              </Text>
              <View style={styles.sovereigntyChip}>
                <View style={styles.dotGood} />
                <Text style={styles.sovereigntyText}>Stored in France · Yours</Text>
              </View>
              <PrimaryButton testID="onboarding-start" label="Begin" onPress={() => setStep(1)} />
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepWrap}>
              <Text style={styles.eyebrow}>01 — Profile</Text>
              <Text style={styles.title}>Tell Labs who is being measured.</Text>

              <Field label="Name">
                <TextInput
                  testID="onboarding-name"
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textTertiary}
                />
              </Field>

              <Field label="Sport / Discipline">
                <TextInput
                  testID="onboarding-sport"
                  value={sport}
                  onChangeText={setSport}
                  style={styles.input}
                  placeholder="Trail, Triathlon, Cycling…"
                  placeholderTextColor={colors.textTertiary}
                />
              </Field>

              <Field label="Training goal">
                <TextInput
                  testID="onboarding-goal"
                  value={goal}
                  onChangeText={setGoal}
                  style={styles.input}
                  placeholder="Goal & target date"
                  placeholderTextColor={colors.textTertiary}
                />
              </Field>

              <PrimaryButton
                testID="onboarding-step-1-next"
                label="Continue"
                onPress={() => setStep(2)}
                disabled={!name || !sport || !goal}
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepWrap}>
              <Text style={styles.eyebrow}>02 — Data sources</Text>
              <Text style={styles.title}>Connect Apple Health.</Text>
              <Text style={styles.bodyText}>
                Labs reads HRV, Resting HR, Sleep, Workouts and Steps. Data stays
                yours — readable, exportable, deletable.
              </Text>

              <View style={styles.healthCard} testID="onboarding-health-card">
                <View style={styles.healthHeader}>
                  <Ionicons name="heart" size={20} color={colors.alert} />
                  <Text style={styles.healthTitle}>Apple Health</Text>
                  {healthConnected && (
                    <View style={styles.connectedPill}>
                      <View style={styles.dotGood} />
                      <Text style={styles.connectedText}>Connected</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.healthMeta}>
                  HRV · Resting HR · Sleep · Workouts · Steps
                </Text>
                <TouchableOpacity
                  testID="onboarding-connect-health"
                  onPress={() => setHealthConnected(true)}
                  disabled={healthConnected}
                  style={[
                    styles.connectBtn,
                    healthConnected && styles.connectBtnDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.connectBtnLabel,
                      healthConnected && styles.connectBtnLabelDone,
                    ]}
                  >
                    {healthConnected ? "Authorized" : "Authorize"}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fineprint}>
                Demo build · Apple Health authorization is simulated via the same
                adapter used by the native HealthKit bridge.
              </Text>

              <PrimaryButton
                testID="onboarding-step-2-next"
                label="Continue"
                onPress={() => setStep(3)}
              />
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepWrap}>
              <Text style={styles.eyebrow}>03 — Baseline</Text>
              <Text style={styles.title}>Learning your normal.</Text>

              <View style={styles.calibrationCard}>
                <View style={styles.calibrationDot} />
                <Text style={styles.calibrationHeader}>Personal baseline band</Text>
                <Text style={styles.calibrationBody}>
                  Over your first two weeks, Labs computes the range that is
                  normal for <Text style={{ color: colors.textPrimary }}>you</Text> — never a
                  population average. Every value in this app is shown against
                  that shaded band.
                </Text>
                <View style={styles.calibrationBand} />
              </View>

              <View style={styles.demoCard}>
                <Ionicons name="flash" size={16} color={colors.teal} />
                <Text style={styles.demoText}>
                  Demo dataset pre-loaded: 10 weeks of trail-running data, baselines
                  ready.
                </Text>
              </View>

              <PrimaryButton
                testID="onboarding-finish"
                label={submitting ? "Opening…" : "Enter Labs"}
                onPress={finish}
                disabled={submitting}
                trailing={submitting ? <ActivityIndicator color={colors.bg} /> : null}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {children}
  </View>
);

const PrimaryButton: React.FC<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  trailing?: React.ReactNode;
}> = ({ label, onPress, disabled, testID, trailing }) => (
  <TouchableOpacity
    testID={testID}
    onPress={onPress}
    disabled={disabled}
    style={[styles.primaryBtn, disabled && { opacity: 0.4 }]}
    activeOpacity={0.85}
  >
    <Text style={styles.primaryBtnLabel}>{label}</Text>
    {trailing}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingTop: spacing.lg,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.xxl,
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  progressDotActive: { backgroundColor: colors.teal },
  stepWrap: { flex: 1, gap: spacing.lg },
  brandMark: {
    ...numeric,
    fontSize: 14,
    letterSpacing: 8,
    color: colors.teal,
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "500",
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 40,
  },
  heroBody: {
    ...typography.bodySecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  sovereigntyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    alignSelf: "flex-start",
    marginTop: spacing.lg,
  },
  sovereigntyText: { ...typography.caption, color: colors.textPrimary },
  dotGood: { width: 6, height: 6, borderRadius: 4, backgroundColor: colors.good },
  eyebrow: {
    ...typography.label,
    color: colors.teal,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.md,
  },
  bodyText: { ...typography.bodySecondary },
  field: { gap: 6 },
  fieldLabel: { ...typography.label },
  input: {
    color: colors.textPrimary,
    fontSize: 17,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
  },
  healthCard: {
    padding: spacing.lg,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    gap: spacing.sm,
  },
  healthHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  healthTitle: { ...typography.h2, fontSize: 17 },
  healthMeta: { ...typography.caption, color: colors.textSecondary, fontSize: 12 },
  connectedPill: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.tealMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  connectedText: { color: colors.teal, fontSize: 11, fontWeight: "600" },
  connectBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.tealMuted,
    borderColor: colors.teal,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  connectBtnDone: { borderColor: colors.border, backgroundColor: "transparent" },
  connectBtnLabel: { color: colors.teal, fontWeight: "600" },
  connectBtnLabelDone: { color: colors.textSecondary },
  fineprint: { ...typography.caption, fontSize: 11, color: colors.textTertiary },
  calibrationCard: {
    padding: spacing.lg,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.card,
    gap: spacing.sm,
  },
  calibrationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal },
  calibrationHeader: { ...typography.h2, fontSize: 17 },
  calibrationBody: { ...typography.bodySecondary, fontSize: 14, lineHeight: 21 },
  calibrationBand: {
    marginTop: spacing.sm,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.tealFaint,
    borderColor: colors.tealMuted,
    borderWidth: 1,
  },
  demoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.card,
    backgroundColor: colors.tealFaint,
  },
  demoText: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  primaryBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.teal,
    paddingVertical: 16,
    borderRadius: radii.pill,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnLabel: { color: colors.bg, fontWeight: "700", fontSize: 16 },
});
