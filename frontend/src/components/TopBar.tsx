import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { colors, spacing, radius } from "@/src/theme/tokens";

export type TopBarProps = {
  title: string;
  subtitle?: string;
  search?: string;
  onSearchChange?: (v: string) => void;
  onSync?: () => void;
  syncing?: boolean;
  rightExtra?: React.ReactNode;
};

export default function TopBar({ title, subtitle, search, onSearchChange, onSync, syncing, rightExtra }: TopBarProps) {
  return (
    <View style={styles.wrap} testID="topbar">
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {onSearchChange && (
        <View style={styles.searchWrap}>
          <Feather name="search" size={14} color={colors.muted} />
          <TextInput
            testID="topbar-search"
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search bookings"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>
      )}
      {rightExtra}
      {onSync && (
        <Pressable
          testID="sync-button"
          onPress={onSync}
          disabled={syncing}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }, syncing && { opacity: 0.6 }]}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <>
              <Feather name="refresh-cw" size={14} color={colors.brand} />
              <Text style={styles.iconBtnText}>Sync</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 72,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 38,
    width: 260,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.onSurface, outlineWidth: 0 as any },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
  },
  iconBtnText: { fontSize: 13, color: colors.brand, fontWeight: "600" },
});
