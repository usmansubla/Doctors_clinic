import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import TopBar from "@/src/components/TopBar";
import { colors, spacing, radius, shadow } from "@/src/theme/tokens";
import { api } from "@/src/api/client";

type Client = {
  key: string;
  name: string;
  phone: string;
  total_bookings: number;
  completed: number;
  no_shows: number;
  cancelled: number;
  upcoming: number;
  total_spent: number;
  last_visit: string | null;
  next_visit: string | null;
};

const fmtMoney = (v?: number) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function ClientsScreen() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"bookings" | "spent" | "name">("bookings");

  const load = useCallback(async () => {
    try {
      const r = await api.clients();
      setClients(r.clients);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = q
      ? clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      : clients;
    arr = [...arr];
    if (sortKey === "spent") arr.sort((a, b) => b.total_spent - a.total_spent);
    else if (sortKey === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else arr.sort((a, b) => b.total_bookings - a.total_bookings);
    return arr;
  }, [clients, search, sortKey]);

  const totals = useMemo(() => {
    const t = { clients: clients.length, revenue: 0, repeat: 0, upcoming: 0 };
    clients.forEach((c) => {
      t.revenue += c.total_spent;
      if (c.total_bookings > 1) t.repeat += 1;
      t.upcoming += c.upcoming;
    });
    return t;
  }, [clients]);

  return (
    <View style={{ flex: 1 }} testID="clients-screen">
      <TopBar title="Clients" subtitle={`${clients.length} unique clients`} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary Row */}
        <View style={styles.summaryRow}>
          <SummaryCard label="Total Clients" value={String(totals.clients)} icon="users" color={colors.info} tint={colors.infoSoft} />
          <SummaryCard label="Repeat Clients" value={String(totals.repeat)} icon="repeat" color={colors.brand} tint={colors.brandTertiary} />
          <SummaryCard label="Lifetime Revenue" value={fmtMoney(totals.revenue)} icon="dollar-sign" color={colors.success} tint={colors.successSoft} />
          <SummaryCard label="Upcoming Visits" value={String(totals.upcoming)} icon="calendar" color={colors.warning} tint={colors.warningSoft} />
        </View>

        {/* List Card */}
        <View style={styles.card}>
          <View style={styles.filterBar}>
            <View style={styles.searchWrap}>
              <Feather name="search" size={14} color={colors.muted} />
              <TextInput
                testID="clients-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or phone"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
              />
            </View>
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              {[
                { k: "bookings" as const, l: "Bookings" },
                { k: "spent" as const, l: "Spend" },
                { k: "name" as const, l: "Name" },
              ].map((s) => (
                <Pressable
                  key={s.k}
                  testID={`sort-${s.k}`}
                  onPress={() => setSortKey(s.k)}
                  style={[styles.sortChip, sortKey === s.k && styles.sortChipActive]}
                >
                  <Text style={[styles.sortChipText, sortKey === s.k && styles.sortChipTextActive]}>{s.l}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2 }]}>Client</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Contact</Text>
            <Text style={[styles.th, { flex: 1 }]}>Bookings</Text>
            <Text style={[styles.th, { flex: 1 }]}>Total Spent</Text>
            <Text style={[styles.th, { flex: 1.1 }]}>Last / Next</Text>
            <Text style={[styles.th, { width: 40 }]}></Text>
          </View>

          {loading ? (
            <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
              <Feather name="users" size={40} color={colors.borderStrong} />
              <Text style={{ color: colors.muted, marginTop: 10, fontSize: 13 }}>No clients found</Text>
            </View>
          ) : (
            filtered.map((c) => (
              <Pressable
                key={c.key}
                testID={`client-row-${c.key}`}
                onPress={() => router.push(`/(app)/client/${encodeURIComponent(c.key)}` as any)}
                style={({ pressed }) => [styles.tr, pressed && { backgroundColor: colors.canvas }]}
              >
                <View style={{ flex: 2, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(c.name || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{c.name}</Text>
                    {c.total_bookings > 1 && (
                      <View style={styles.repeatBadge}>
                        <Feather name="repeat" size={9} color={colors.brand} />
                        <Text style={styles.repeatText}>Repeat</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.tdText, { flex: 1.2 }]}>{c.phone || "—"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tdText}>{c.total_bookings}</Text>
                  <Text style={styles.rowMeta}>
                    {c.completed}✓  {c.no_shows > 0 ? `${c.no_shows}⚠ ` : ""}{c.cancelled > 0 ? `${c.cancelled}✗` : ""}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tdText}>{fmtMoney(c.total_spent)}</Text>
                </View>
                <View style={{ flex: 1.1 }}>
                  <Text style={styles.rowMeta}>Last: {c.last_visit || "—"}</Text>
                  <Text style={[styles.rowMeta, c.next_visit && { color: colors.brand, fontWeight: "600" }]}>
                    Next: {c.next_visit || "—"}
                  </Text>
                </View>
                <View style={{ width: 40, alignItems: "flex-end" }}>
                  <Feather name="chevron-right" size={16} color={colors.muted} />
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value, icon, color, tint }: any) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHead}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <View style={[styles.summaryIcon, { backgroundColor: tint }]}>
          <Feather name={icon} size={14} color={color} />
        </View>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, paddingBottom: 60, gap: spacing.lg },
  summaryRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  summaryCard: {
    flex: 1, minWidth: 200, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  summaryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 12, color: colors.muted, fontWeight: "500", flex: 1 },
  summaryIcon: { width: 30, height: 30, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 26, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md, letterSpacing: -0.5 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  filterBar: {
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap",
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.canvas,
    borderRadius: radius.md, paddingHorizontal: spacing.md, height: 38, minWidth: 260, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border, flex: 1, maxWidth: 400,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.onSurface, outlineWidth: 0 as any },
  sortRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sortLabel: { fontSize: 12, color: colors.muted },
  sortChip: { paddingHorizontal: 12, height: 30, borderRadius: radius.pill, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  sortChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  sortChipText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  sortChipTextActive: { color: colors.onBrand },

  tableHeader: {
    flexDirection: "row", alignItems: "center", paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg, backgroundColor: colors.canvas,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  th: { fontSize: 11, color: colors.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  tr: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  tdText: { fontSize: 13, color: colors.onSurface, fontWeight: "500" },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  avatar: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brand, fontWeight: "700", fontSize: 13 },
  rowName: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  repeatBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    alignSelf: "flex-start", marginTop: 3,
    paddingHorizontal: 6, paddingVertical: 1,
    backgroundColor: colors.brandTertiary, borderRadius: radius.pill,
  },
  repeatText: { fontSize: 9, color: colors.brand, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
});
