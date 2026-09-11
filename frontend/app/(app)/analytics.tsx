import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import TopBar from "@/src/components/TopBar";
import { LineChart, BarChart, DonutChart } from "@/src/components/Charts";
import { colors, spacing, radius, shadow } from "@/src/theme/tokens";
import { api } from "@/src/api/client";

type Analytics = {
  days: { label: string; date: string; total: number; completed: number; cancelled: number; upcoming: number; no_show: number; revenue: number }[];
  total_week: number;
  completion_rate: number;
  cancellation_rate: number;
  no_show_rate: number;
};

export default function AnalyticsPage() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState<Analytics | null>(null);
  const [services, setServices] = useState<{ service_type: string; count: number; revenue: number }[]>([]);

  const load = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([api.analytics(), api.services()]);
      setData(a);
      setServices(s.services || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const chartWidth = Math.min(width - 320, 800);
  const halfWidth = Math.min((width - 380) / 2, 480);
  const compact = width < 1200;

  return (
    <View style={{ flex: 1 }} testID="analytics-screen">
      <TopBar title="Analytics" subtitle="Deep insights into your bookings performance" />
      <ScrollView contentContainerStyle={styles.content}>
        {!data ? (
          <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <SummaryCard label="Total Bookings" value={data.total_week} icon="calendar" color={colors.info} tint={colors.infoSoft} sub="Last 7 days" />
              <SummaryCard label="Revenue This Week" value={`$${data.days.reduce((a, b) => a + b.revenue, 0).toFixed(0)}`} icon="dollar-sign" color={colors.brand} tint={colors.brandTertiary} sub="From completed" />
              <SummaryCard label="Completion Rate" value={`${data.completion_rate}%`} icon="check-circle" color={colors.success} tint={colors.successSoft} sub="Of total bookings" />
              <SummaryCard label="No-Show Rate" value={`${data.no_show_rate}%`} icon="alert-triangle" color="#B0730B" tint="#FFF4DE" sub="Need follow-up" />
            </View>

            <View style={[styles.chartsRow, compact && { flexDirection: "column" }]}>
              <View style={[styles.card, { flex: 2 }]}>
                <Text style={styles.cardTitle}>Revenue Trend (7 days)</Text>
                <Text style={styles.cardSub}>Daily completed revenue ($)</Text>
                <View style={{ position: "relative", marginTop: spacing.md }}>
                  <LineChart
                    data={data.days.map((d) => ({ label: d.label, value: d.revenue }))}
                    width={chartWidth}
                    height={260}
                    color={colors.brand}
                  />
                  <View style={styles.xAxis}>
                    {data.days.map((d) => (
                      <Text key={d.date} style={styles.xLabel}>{d.label}</Text>
                    ))}
                  </View>
                </View>
              </View>

              <View style={[styles.card, { flex: 1, minWidth: 300, alignItems: "center" }]}>
                <View style={{ alignSelf: "stretch" }}>
                  <Text style={styles.cardTitle}>Status Distribution</Text>
                  <Text style={styles.cardSub}>This week breakdown</Text>
                </View>
                <View style={{ position: "relative", marginTop: spacing.lg, alignItems: "center", justifyContent: "center" }}>
                  <DonutChart
                    size={200}
                    segments={[
                      { value: data.days.reduce((a, b) => a + b.completed, 0), color: colors.success, label: "Completed" },
                      { value: data.days.reduce((a, b) => a + b.upcoming, 0), color: colors.warning, label: "Upcoming" },
                      { value: data.days.reduce((a, b) => a + b.no_show, 0), color: "#B0730B", label: "No-Show" },
                      { value: data.days.reduce((a, b) => a + b.cancelled, 0), color: colors.error, label: "Cancelled" },
                    ]}
                  />
                  <View style={styles.donutCenter}>
                    <Text style={styles.donutValue}>{data.total_week}</Text>
                    <Text style={styles.donutLabel}>Total</Text>
                  </View>
                </View>
                <View style={{ marginTop: spacing.lg, alignSelf: "stretch", gap: 6 }}>
                  <LegendRow color={colors.success} label="Completed" value={data.days.reduce((a, b) => a + b.completed, 0)} />
                  <LegendRow color={colors.warning} label="Upcoming" value={data.days.reduce((a, b) => a + b.upcoming, 0)} />
                  <LegendRow color="#B0730B" label="No-Show" value={data.days.reduce((a, b) => a + b.no_show, 0)} />
                  <LegendRow color={colors.error} label="Cancelled" value={data.days.reduce((a, b) => a + b.cancelled, 0)} />
                </View>
              </View>
            </View>

            <View style={[styles.chartsRow, compact && { flexDirection: "column" }]}>
              <View style={[styles.card, { flex: 1 }]}>
                <Text style={styles.cardTitle}>Completed vs Cancelled</Text>
                <Text style={styles.cardSub}>Daily comparison</Text>
                <View style={{ position: "relative", marginTop: spacing.md, height: 200 }}>
                  <View style={{ flexDirection: "row", height: 180, alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 8 }}>
                    {data.days.map((d) => {
                      const max = Math.max(1, ...data.days.map((x) => Math.max(x.completed, x.cancelled)));
                      const cH = (d.completed / max) * 140;
                      const xH = (d.cancelled / max) * 140;
                      return (
                        <View key={d.date} style={{ alignItems: "center", flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 150 }}>
                            <View style={{ width: 10, height: Math.max(2, cH), backgroundColor: colors.success, borderRadius: 3 }} />
                            <View style={{ width: 10, height: Math.max(2, xH), backgroundColor: colors.error, borderRadius: 3 }} />
                          </View>
                          <Text style={styles.xLabelInline}>{d.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.md }}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSquare, { backgroundColor: colors.success }]} />
                    <Text style={styles.legendText}>Completed</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSquare, { backgroundColor: colors.error }]} />
                    <Text style={styles.legendText}>Cancelled</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.card, { flex: 1 }]}>
                <Text style={styles.cardTitle}>Performance Rates</Text>
                <Text style={styles.cardSub}>Weekly booking outcomes</Text>
                <RateBar label="Completion Rate" value={data.completion_rate} color={colors.success} />
                <RateBar label="No-Show Rate" value={data.no_show_rate} color="#B0730B" />
                <RateBar label="Cancellation Rate" value={data.cancellation_rate} color={colors.error} />
              </View>
            </View>

            {/* Revenue by Service */}
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <Text style={styles.cardTitle}>Revenue by Service</Text>
                  <Text style={styles.cardSub}>Which treatments drive your revenue this week</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSquare, { backgroundColor: colors.brand }]} />
                  <Text style={styles.legendText}>Revenue ($)</Text>
                </View>
              </View>
              {services.length === 0 ? (
                <Text style={{ color: colors.muted, textAlign: "center", padding: spacing.xl }}>No service data yet</Text>
              ) : (
                <View style={{ marginTop: spacing.md }}>
                  {(() => {
                    const maxRev = Math.max(1, ...services.map((s) => s.revenue));
                    return services.map((s) => (
                      <View key={s.service_type} style={styles.svcRow}>
                        <View style={styles.svcNameCol}>
                          <Text style={styles.svcName}>{s.service_type}</Text>
                          <Text style={styles.svcCount}>{s.count} booking{s.count === 1 ? "" : "s"}</Text>
                        </View>
                        <View style={styles.svcBarWrap}>
                          <View style={[styles.svcBar, { width: `${Math.max(2, (s.revenue / maxRev) * 100)}%`, backgroundColor: s.revenue > 0 ? colors.brand : colors.borderStrong }]} />
                        </View>
                        <Text style={styles.svcAmount}>${s.revenue.toFixed(0)}</Text>
                      </View>
                    ));
                  })()}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value, icon, color, tint, sub }: any) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHead}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <View style={[styles.summaryIcon, { backgroundColor: tint }]}>
          <Feather name={icon} size={14} color={color} />
        </View>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summarySub}>{sub}</Text>
    </View>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View style={styles.legendItemRow}>
      <View style={[styles.legendSquare, { backgroundColor: color }]} />
      <Text style={{ flex: 1, fontSize: 12, color: colors.onSurfaceSecondary }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onSurface }}>{value}</Text>
    </View>
  );
}

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 13, color: colors.onSurfaceSecondary, fontWeight: "600" }}>{label}</Text>
        <Text style={{ fontSize: 13, color, fontWeight: "700" }}>{value}%</Text>
      </View>
      <View style={{ height: 10, backgroundColor: colors.canvas, borderRadius: 5, overflow: "hidden" }}>
        <View style={{ width: `${Math.min(100, value)}%`, height: "100%", backgroundColor: color, borderRadius: 5 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, paddingBottom: 60, gap: spacing.lg },
  summaryRow: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  summaryCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  summaryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 12, color: colors.muted, fontWeight: "500", flex: 1 },
  summaryIcon: { width: 30, height: 30, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 28, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md, letterSpacing: -0.5 },
  summarySub: { fontSize: 11, color: colors.muted, marginTop: 4 },

  chartsRow: { flexDirection: "row", gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },

  xAxis: { flexDirection: "row", paddingLeft: 36, paddingRight: 20, marginTop: -18 },
  xLabel: { flex: 1, fontSize: 10, color: colors.muted, textAlign: "center" },
  xLabelInline: { fontSize: 10, color: colors.muted, marginTop: 4 },

  donutCenter: { position: "absolute", alignItems: "center" },
  donutValue: { fontSize: 24, fontWeight: "700", color: colors.onSurface },
  donutLabel: { fontSize: 11, color: colors.muted },

  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendItemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  legendSquare: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "500" },

  svcRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  svcNameCol: { width: 130 },
  svcName: { fontSize: 13, color: colors.onSurface, fontWeight: "600" },
  svcCount: { fontSize: 10, color: colors.muted, marginTop: 2 },
  svcBarWrap: { flex: 1, height: 22, backgroundColor: colors.canvas, borderRadius: radius.sm, overflow: "hidden" },
  svcBar: { height: "100%", borderRadius: radius.sm },
  svcAmount: { width: 80, fontSize: 14, color: colors.onSurface, fontWeight: "700", textAlign: "right" },
});
