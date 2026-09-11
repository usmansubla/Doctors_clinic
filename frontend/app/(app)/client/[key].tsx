import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import TopBar from "@/src/components/TopBar";
import { colors, spacing, radius, shadow } from "@/src/theme/tokens";
import { api } from "@/src/api/client";

const fmtMoney = (v?: number) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const badgeStyle = (s: string) => {
  switch (s) {
    case "completed":
      return { bg: colors.successSoft, color: colors.success };
    case "cancelled":
      return { bg: colors.errorSoft, color: colors.error };
    case "no_show":
      return { bg: "#FFF4DE", color: "#B0730B" };
    default:
      return { bg: colors.warningSoft, color: colors.warning };
  }
};

export default function ClientDetail() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!key) return;
    try {
      const d = await api.client(String(key));
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1 }} testID="client-detail-screen">
      <TopBar title="Client Profile" subtitle="Full history, notes & spend" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.backLink}>
          <Feather name="arrow-left" size={14} color={colors.brand} />
          <Text style={styles.backText}>Back to Clients</Text>
        </Pressable>

        {loading ? (
          <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : !data ? (
          <Text style={{ color: colors.muted, textAlign: "center", padding: spacing.xxxl }}>Client not found</Text>
        ) : (
          <>
            {/* Header card */}
            <View style={styles.headerCard}>
              <View style={styles.avatarBig}>
                <Text style={styles.avatarBigText}>{(data.name || "?").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{data.name}</Text>
                <View style={styles.clientMetaRow}>
                  <View style={styles.metaItem}>
                    <Feather name="phone" size={12} color={colors.muted} />
                    <Text style={styles.metaText}>{data.phone || "No phone"}</Text>
                  </View>
                  {data.total_bookings > 1 && (
                    <View style={styles.repeatBadge}>
                      <Feather name="repeat" size={10} color={colors.brand} />
                      <Text style={styles.repeatText}>Repeat Client</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.headerStats}>
                <View style={styles.headerStat}>
                  <Text style={styles.headerStatLabel}>Total Spent</Text>
                  <Text style={[styles.headerStatValue, { color: colors.brand }]}>{fmtMoney(data.total_spent)}</Text>
                </View>
                {data.unpaid_amount > 0 && (
                  <View style={styles.headerStat}>
                    <Text style={styles.headerStatLabel}>Unpaid</Text>
                    <Text style={[styles.headerStatValue, { color: colors.warning }]}>{fmtMoney(data.unpaid_amount)}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <StatCell label="Total Visits" value={data.total_bookings} icon="calendar" color={colors.info} tint={colors.infoSoft} />
              <StatCell label="Completed" value={data.completed} icon="check-circle" color={colors.success} tint={colors.successSoft} />
              <StatCell label="No-Shows" value={data.no_shows} icon="alert-triangle" color="#B0730B" tint="#FFF4DE" />
              <StatCell label="Cancelled" value={data.cancelled} icon="x-circle" color={colors.error} tint={colors.errorSoft} />
              <StatCell label="Upcoming" value={data.upcoming} icon="clock" color={colors.warning} tint={colors.warningSoft} />
            </View>

            <View style={styles.twoCol}>
              {/* Visit History */}
              <View style={[styles.card, { flex: 2 }]}>
                <Text style={styles.cardTitle}>Visit History</Text>
                <Text style={styles.cardSub}>All appointments — most recent first</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { flex: 1.4 }]}>Date & Time</Text>
                  <Text style={[styles.th, { flex: 1.2 }]}>Service</Text>
                  <Text style={[styles.th, { flex: 0.8 }]}>Price</Text>
                  <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                </View>
                {data.bookings.map((b: any) => {
                  const st = badgeStyle(b.status);
                  return (
                    <View key={b.id} style={styles.tr}>
                      <View style={{ flex: 1.4 }}>
                        <Text style={styles.tdText}>{b.date}</Text>
                        <Text style={styles.rowMeta}>{b.time}</Text>
                      </View>
                      <View style={{ flex: 1.2 }}>
                        <View style={styles.servicePill}>
                          <Text style={styles.servicePillText}>{b.service_type || "General"}</Text>
                        </View>
                      </View>
                      <View style={{ flex: 0.8 }}>
                        <Text style={styles.tdText}>{fmtMoney(b.price || 0)}</Text>
                        {b.paid ? (
                          <Text style={[styles.rowMeta, { color: colors.success, fontWeight: "600" }]}>Paid</Text>
                        ) : b.price > 0 ? (
                          <Text style={[styles.rowMeta, { color: colors.warning, fontWeight: "600" }]}>Unpaid</Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={[styles.badge, { backgroundColor: st.bg, alignSelf: "flex-start" }]}>
                          <Text style={[styles.badgeText, { color: st.color }]}>{b.status.replace("_", "-")}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Notes timeline + services */}
              <View style={{ flex: 1, gap: spacing.lg, minWidth: 260 }}>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Services Used</Text>
                  <Text style={styles.cardSub}>Breakdown of appointments</Text>
                  {Object.entries(data.services || {}).length === 0 ? (
                    <Text style={styles.emptyText}>—</Text>
                  ) : (
                    Object.entries(data.services)
                      .sort(([, a]: any, [, b]: any) => (b as number) - (a as number))
                      .map(([name, count]: any) => (
                        <View key={name} style={styles.serviceRow}>
                          <Text style={styles.serviceName}>{name}</Text>
                          <View style={styles.serviceCount}>
                            <Text style={styles.serviceCountText}>{count}</Text>
                          </View>
                        </View>
                      ))
                  )}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Notes Timeline</Text>
                  <Text style={styles.cardSub}>All saved notes for this client</Text>
                  {data.notes_timeline.length === 0 ? (
                    <View style={{ alignItems: "center", padding: spacing.lg }}>
                      <Feather name="edit-3" size={28} color={colors.borderStrong} />
                      <Text style={[styles.emptyText, { marginTop: 8 }]}>No notes saved yet</Text>
                    </View>
                  ) : (
                    data.notes_timeline.map((n: any, i: number) => (
                      <View key={i} style={styles.noteItem}>
                        <View style={styles.noteHead}>
                          <Text style={styles.noteDate}>{n.date} • {n.time}</Text>
                          <View style={styles.servicePill}>
                            <Text style={styles.servicePillText}>{n.service_type}</Text>
                          </View>
                        </View>
                        <Text style={styles.noteText}>{n.note}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCell({ label, value, icon, color, tint }: any) {
  return (
    <View style={styles.statCell}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Feather name={icon} size={13} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, paddingBottom: 60, gap: spacing.lg },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  backText: { fontSize: 13, color: colors.brand, fontWeight: "600" },

  headerCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadow.card,
    flexDirection: "row", alignItems: "center", gap: spacing.lg, flexWrap: "wrap",
  },
  avatarBig: { width: 68, height: 68, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarBigText: { color: colors.onBrand, fontWeight: "700", fontSize: 28 },
  clientName: { fontSize: 24, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.5 },
  clientMetaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 4, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, color: colors.muted },
  repeatBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: colors.brandTertiary, borderRadius: radius.pill,
  },
  repeatText: { fontSize: 10, color: colors.brand, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  headerStats: { flexDirection: "row", gap: spacing.xl, marginLeft: "auto" },
  headerStat: { alignItems: "flex-end" },
  headerStatLabel: { fontSize: 11, color: colors.muted },
  headerStatValue: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5, marginTop: 2 },

  statsGrid: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
  statCell: {
    flex: 1, minWidth: 140, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", gap: spacing.md, ...shadow.card,
  },
  statIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 20, fontWeight: "700", color: colors.onSurface, letterSpacing: -0.3 },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },

  twoCol: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: spacing.md },

  tableHeader: { flexDirection: "row", paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  th: { fontSize: 10, color: colors.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tdText: { fontSize: 13, color: colors.onSurface, fontWeight: "500" },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },

  servicePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border, alignSelf: "flex-start" },
  servicePillText: { fontSize: 11, color: colors.onSurfaceSecondary, fontWeight: "600" },

  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },

  serviceRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  serviceName: { fontSize: 13, color: colors.onSurface, fontWeight: "500" },
  serviceCount: { minWidth: 26, height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  serviceCountText: { fontSize: 12, color: colors.brand, fontWeight: "700" },

  noteItem: {
    padding: spacing.md, backgroundColor: colors.canvas,
    borderRadius: radius.md, marginBottom: spacing.sm,
  },
  noteHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  noteDate: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  noteText: { fontSize: 13, color: colors.onSurface, lineHeight: 18 },

  emptyText: { fontSize: 12, color: colors.muted, textAlign: "center" },
});
