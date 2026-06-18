import React from "react";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, mono } from "@/src/theme";

const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  today: ["pulse-outline", "pulse"],
  biomarkers: ["water-outline", "water"],
  trends: ["analytics-outline", "analytics"],
  invie: ["chatbubble-ellipses-outline", "chatbubble-ellipses"],
  vault: ["shield-outline", "shield"],
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: Platform.OS === "android" ? "rgba(5,5,7,0.96)" : "transparent",
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: mono,
          letterSpacing: 1,
          marginTop: 2,
          textTransform: "uppercase",
        },
        tabBarBackground:
          Platform.OS === "ios"
            ? () => (
                <BlurView
                  intensity={50}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                />
              )
            : undefined,
        tabBarIcon: ({ focused, color, size }) => {
          const [outline, filled] = TAB_ICONS[route.name] ?? TAB_ICONS.today;
          return (
            <Ionicons name={focused ? filled : outline} size={size - 2} color={color} />
          );
        },
      })}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="biomarkers" options={{ title: "Biomarkers" }} />
      <Tabs.Screen name="trends" options={{ title: "Trends" }} />
      <Tabs.Screen name="invie" options={{ title: "Invie" }} />
      <Tabs.Screen name="vault" options={{ title: "Vault" }} />
    </Tabs>
  );
}
