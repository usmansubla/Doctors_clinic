import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { usePathname, useRouter } from "expo-router";
import { colors, spacing, radius } from "@/src/theme/tokens";
import { useAuth } from "@/src/context/AuthContext";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "grid" as const, path: "/(app)/dashboard" },
  { key: "bookings", label: "Bookings", icon: "calendar" as const, path: "/(app)/bookings" },
  { key: "clients", label: "Clients", icon: "users" as const, path: "/(app)/clients" },
  { key: "analytics", label: "Analytics", icon: "bar-chart-2" as const, path: "/(app)/analytics" },
  { key: "settings", label: "Settings", icon: "settings" as const, path: "/(app)/settings" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 1100;

  return (
    <View style={[styles.sidebar, { width: compact ? 84 : 240 }]} testID="sidebar">
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <Feather name="activity" size={20} color={colors.onBrand} />
        </View>
        {!compact && (
          <View>
            <Text style={styles.brandName}>ClinicFlow</Text>
            <Text style={styles.brandSub}>Dental CRM</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        {!compact && <Text style={styles.groupLabel}>MAIN</Text>}
        {NAV.map((item) => {
          const active = pathname.includes(`/${item.key}`);
          return (
            <Pressable
              key={item.key}
              testID={`nav-${item.key}`}
              onPress={() => router.push(item.path as any)}
              style={({ pressed }) => [
                styles.navItem,
                compact && styles.navItemCompact,
                active && styles.navItemActive,
                pressed && !active && { backgroundColor: colors.sidebarHover },
              ]}
            >
              <Feather name={item.icon} size={18} color={active ? colors.brand : colors.onSurfaceTertiary} />
              {!compact && (
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              )}
              {active && <View style={styles.activeBar} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.userCard, compact && { padding: spacing.sm, alignItems: "center" }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || "U"}</Text>
        </View>
        {!compact && (
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name || "Admin"}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
        )}
        <Pressable testID="logout-btn" onPress={logout} style={styles.logoutBtn} hitSlop={6}>
          <Feather name="log-out" size={14} color={colors.error} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    height: "100%",
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.lg,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontSize: 16, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.3 },
  brandSub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  groupLabel: {
    fontSize: 10,
    color: colors.mutedLight,
    letterSpacing: 1.2,
    fontWeight: "700",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    height: 42,
    borderRadius: radius.md,
    marginBottom: 2,
    position: "relative",
  },
  navItemCompact: { justifyContent: "center", paddingHorizontal: 0 },
  navItemActive: { backgroundColor: colors.sidebarActive },
  navLabel: { fontSize: 14, color: colors.onSurfaceTertiary, fontWeight: "500" },
  navLabelActive: { color: colors.brand, fontWeight: "600" },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: colors.brand,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  userCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onBrand, fontWeight: "700", fontSize: 13 },
  userName: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  userEmail: { fontSize: 11, color: colors.muted },
  logoutBtn: { padding: spacing.xs },
});
