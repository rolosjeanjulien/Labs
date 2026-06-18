import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radii, spacing, typography, numeric } from "@/src/theme";
import { api } from "@/src/api";

type Msg = { id: string; role: "user" | "invie"; text: string; verdict?: string };

const SUGGESTED = [
  "Why is my readiness where it is?",
  "What does my sIgA mean?",
  "Should I train hard today?",
  "Explain my personal baseline.",
];

export default function InvieScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", text: trimmed };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setSending(true);
      try {
        const r = await api.invieChat(trimmed);
        setMessages((m) => [
          ...m,
          { id: `i-${Date.now()}`, role: "invie", text: r.reply, verdict: r.verdict },
        ]);
      } catch (e: any) {
        setMessages((m) => [
          ...m,
          {
            id: `i-${Date.now()}`,
            role: "invie",
            text: "I couldn't reach the data layer right now. Try again in a moment.",
          },
        ]);
      } finally {
        setSending(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      }
    },
    [sending],
  );

  // Seed an opening reading on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await api.invieInsight();
        setMessages([
          {
            id: "boot",
            role: "invie",
            text: r.narrative,
            verdict: r.verdict,
          },
        ]);
      } catch {
        setMessages([
          {
            id: "boot",
            role: "invie",
            text: "Hi — I read your biology and translate it. Ask me anything about your data.",
          },
        ]);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="invie-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.header}>
          <View style={styles.brandIcon}>
            <View style={styles.brandIconDot} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>AI · pluggable</Text>
            <Text style={styles.title}>Invie</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubbleWrap,
                m.role === "user" ? styles.bubbleWrapUser : styles.bubbleWrapInvie,
              ]}
              testID={`msg-${m.role}`}
            >
              {m.role === "invie" && (
                <Text style={styles.invieByline}>INVIE</Text>
              )}
              <View
                style={[
                  styles.bubble,
                  m.role === "user" ? styles.bubbleUser : styles.bubbleInvie,
                ]}
              >
                <Text style={styles.bubbleText}>{m.text}</Text>
              </View>
            </View>
          ))}
          {sending && (
            <View style={styles.bubbleWrapInvie}>
              <Text style={styles.invieByline}>INVIE</Text>
              <View style={[styles.bubble, styles.bubbleInvie, styles.bubbleTyping]}>
                <ActivityIndicator size="small" color={colors.teal} />
                <Text style={styles.typingText}>reading your data…</Text>
              </View>
            </View>
          )}

          {messages.length <= 1 && (
            <View style={styles.suggestRow}>
              {SUGGESTED.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestChip}
                  onPress={() => send(s)}
                  testID={`suggest-${s.slice(0, 8)}`}
                >
                  <Text style={styles.suggestText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
          <TextInput
            testID="invie-input"
            style={styles.input}
            placeholder="Ask about your biology…"
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            editable={!sending}
          />
          <TouchableOpacity
            testID="invie-send"
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
            onPress={() => send(input)}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="arrow-up" size={18} color={colors.bg} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tealMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.teal,
  },
  brandIconDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.teal },
  eyebrow: { ...typography.label, color: colors.teal },
  title: { ...typography.h2, fontSize: 22 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  bubbleWrap: { maxWidth: "85%", gap: 4 },
  bubbleWrapUser: { alignSelf: "flex-end" },
  bubbleWrapInvie: { alignSelf: "flex-start", maxWidth: "92%" },
  invieByline: {
    ...numeric,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.teal,
    marginLeft: spacing.sm,
  },
  bubble: {
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  bubbleUser: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderBottomRightRadius: 4,
  },
  bubbleInvie: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderLeftColor: colors.teal,
    borderLeftWidth: 2,
  },
  bubbleText: { ...typography.body, fontSize: 15, lineHeight: 22 },
  bubbleTyping: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingText: { ...numeric, fontSize: 12, color: colors.textSecondary },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.lg },
  suggestChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  suggestText: { color: colors.textSecondary, fontSize: 12 },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
  },
});
