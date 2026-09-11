import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import TopBar from "@/src/components/TopBar";
import { LineChart, DonutChart, Sparkline } from "@/src/components/Charts";
import { colors, spacing, radius, shadow } from "@/src/theme/tokens";
import { api } from "@/src/api/client";

type Metrics = {
  total_deals: number;
  bookings_left_today: number;
  completed: number;
  cancelled: number;
  no_shows: number;
  revenue_total: number;
  revenue_paid: number;
  revenue_unpaid: number;
  revenue_pipeline: number;
};

type Analytics = {
  days: {
    label: string;
    date: string;
    total: number;
    completed: number;
    cancelled: number;
    upcoming: number;
    no_show: number;
    revenue: number;
  }[];
  total_week: number;
  completion_rate: number;
  cancellation_rate: number;
  no_show_rate: number;
};

type Booking = {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  status: string;
  price?: number;
  paid?: boolean;
};

const KPIS = [
  {
    key: "total_deals",
    label: "Total Deals This Week",
    icon: "trending-up" as const,
    color: colors.info,
    tint: colors.infoSoft,
    sparkKey: "total",
  },
  {
    key: "bookings_left_today",
    label: "Bookings Left Today",
    icon: "clock" as const,
    color: colors.warning,
    tint: colors.warningSoft,
    sparkKey: "upcoming",
  },
  {
    key: "completed",
    label: "Completed This Week",
    icon: "check-circle" as const,
    color: colors.success,
    tint: colors.successSoft,
    sparkKey: "completed",
  },
  {
    key: "no_shows",
    label: "No-Shows This Week",
    icon: "alert-triangle" as const,
    color: "#B0730B",
    tint: "#FFF4DE",
    sparkKey: "no_show",
  },
  {
    key: "cancelled",
    label: "Cancelled This Week",
    icon: "x-circle" as const,
    color: colors.error,
    tint: colors.errorSoft,
    sparkKey: "cancelled",
  },
];

const badgeStyle = (s: string) => {
  switch (s) {
    case "completed":
      return {
        bg: colors.successSoft,
        color: colors.success,
      };

    case "cancelled":
      return {
        bg: colors.errorSoft,
        color: colors.error,
      };

    case "no_show":
      return {
        bg: "#FFF4DE",
        color: "#B0730B",
      };

    default:
      return {
        bg: colors.warningSoft,
        color: colors.warning,
      };
  }
};

const fmtMoney = (v: number) =>
  `$${(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

/*
 * Returns today's date in LOCAL time.
 *
 * Example:
 * 2026-09-11
 *
 * We don't use toISOString() here because that uses UTC,
 * which can sometimes make "today" become yesterday/tomorrow
 * depending on the user's timezone.
 */
const getTodayString = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const router = useRouter();

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  /*
   * IMPORTANT:
   * This contains ALL bookings returned by the API.
   *
   * We use this for:
   * - Recent Bookings
   * - Today's Schedule
   */
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [noShows, setNoShows] = useState<Booking[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [m, a, b, ns] = await Promise.all([
        api.metrics(),
        api.analytics(),
        api.bookings({}),
        api.noShows(),
      ]);

      setMetrics(m);
      setAnalytics(a);

      // Store ALL bookings
      setBookings(b.bookings);

      setNoShows(ns.bookings.slice(0, 5));
    } catch (error) {
      console.log("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const t = setInterval(load, 30_000);

    return () => clearInterval(t);
  }, [load]);

  const runSync = async () => {
    setSyncing(true);

    try {
      await api.sync();
      await load();
    } catch (error) {
      console.log("Sync error:", error);
    } finally {
      setSyncing(false);
    }
  };

  const chartWidth = Math.max(320, Math.min(width - 320, 780));
  const compact = width < 1200;

  const paidPct =
    metrics && metrics.revenue_total > 0
      ? (metrics.revenue_paid / metrics.revenue_total) * 100
      : 0;

  /*
   * --------------------------------------------------
   * RECENT BOOKINGS
   * --------------------------------------------------
   *
   * We take the first 6 bookings from the API.
   *
   * This is separate from today's schedule.
   */
  const recent = bookings.slice(0, 6);

  /*
   * --------------------------------------------------
   * TODAY'S BOOKINGS
   * --------------------------------------------------
   *
   * IMPORTANT:
   * We filter from `bookings`, NOT `recent`.
   *
   * Previously you had:
   *
   * recent.filter(...)
   *
   * That meant if today's booking wasn't inside
   * the first 6 bookings, Today's Schedule showed 0.
   */
  const today = getTodayString();

  const todayList = bookings
    .filter((b) => b.date === today)
    .sort((a, b) => {
      return (a.time || "").localeCompare(b.time || "");
    });

  return (
    <View style={{ flex: 1 }} testID="dashboard-screen">
      <TopBar
        title="Dashboard"
        subtitle="Overview of your clinic's booking performance"
        onSync={runSync}
        syncing={syncing}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View
            style={{
              padding: spacing.xxxl,
              alignItems: "center",
            }}
          >
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <>
            {/* Revenue Banner + No-Show Alert Row */}

            <View
              style={[
                styles.bannerRow,
                compact && { flexDirection: "column" },
              ]}
            >
              <View style={styles.revenueBanner} testID="revenue-banner">
                <View style={styles.revenueLeft}>
                  <View style={styles.revenueIcon}>
                    <Feather
                      name="dollar-sign"
                      size={20}
                      color={colors.onBrand}
                    />
                  </View>

                  <View>
                    <Text style={styles.revenueLabel}>
                      Revenue This Week
                    </Text>

                    <Text
                      style={styles.revenueValue}
                      testID="revenue-total"
                    >
                      {fmtMoney(metrics?.revenue_total ?? 0)}
                    </Text>

                    <Text style={styles.revenuePipeline}>
                      Pipeline: {fmtMoney(metrics?.revenue_pipeline ?? 0)} in
                      upcoming
                    </Text>
                  </View>
                </View>

                <View style={styles.revenueRight}>
                  <View style={styles.revenueStat}>
                    <View style={styles.dotGreen} />

                    <Text style={styles.revenueStatLabel}>Paid</Text>

                    <Text style={styles.revenueStatValue}>
                      {fmtMoney(metrics?.revenue_paid ?? 0)}
                    </Text>
                  </View>

                  <View style={styles.revenueStat}>
                    <View style={styles.dotAmber} />

                    <Text style={styles.revenueStatLabel}>Unpaid</Text>

                    <Text style={styles.revenueStatValue}>
                      {fmtMoney(metrics?.revenue_unpaid ?? 0)}
                    </Text>
                  </View>

                  <View style={styles.paidBarWrap}>
                    <View
                      style={[
                        styles.paidBarFill,
                        {
                          width: `${Math.min(100, paidPct)}%`,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.paidPctText}>
                    {paidPct.toFixed(0)}% collected
                  </Text>
                </View>
              </View>

              <Pressable
                testID="no-show-alert-card"
                onPress={() => router.push("/(app)/bookings")}
                style={({ pressed }) => [
                  styles.alertCard,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.alertHead}>
                  <View style={styles.alertIcon}>
                    <Feather
                      name="alert-triangle"
                      size={16}
                      color="#B0730B"
                    />
                  </View>

                  <Text style={styles.alertTitle}>
                    No-Show Alerts
                  </Text>
                </View>

                <Text style={styles.alertValue}>
                  {noShows.length}
                </Text>

                <Text style={styles.alertSub}>
                  {noShows.length === 0
                    ? "You're all caught up!"
                    : "Need follow-up call"}
                </Text>

                {noShows.slice(0, 2).map((b) => (
                  <View key={b.id} style={styles.alertRow}>
                    <Text style={styles.alertName}>
                      {b.name}
                    </Text>

                    <Text style={styles.alertMeta}>
                      {b.date} • {b.phone || "—"}
                    </Text>
                  </View>
                ))}

                {noShows.length > 2 && (
                  <Text style={styles.alertMore}>
                    + {noShows.length - 2} more →
                  </Text>
                )}
              </Pressable>
            </View>

            {/* KPI Row */}

            <View style={styles.kpiRow}>
              {KPIS.map((k) => {
                const val = (metrics as any)?.[k.key] ?? 0;

                const sparkData =
                  analytics?.days.map(
                    (d: any) => d[k.sparkKey] ?? 0
                  ) ?? [];

                return (
                  <View
                    key={k.key}
                    style={styles.kpiCard}
                    testID={`kpi-card-${k.key}`}
                  >
                    <View style={styles.kpiHead}>
                      <View
                        style={[
                          styles.kpiIcon,
                          {
                            backgroundColor: k.tint,
                          },
                        ]}
                      >
                        <Feather
                          name={k.icon}
                          size={16}
                          color={k.color}
                        />
                      </View>

                      <Text
                        style={styles.kpiLabel}
                        numberOfLines={2}
                      >
                        {k.label}
                      </Text>
                    </View>

                    <View style={styles.kpiBottom}>
                      <Text
                        style={styles.kpiValue}
                        testID={`kpi-value-${k.key}`}
                      >
                        {val}
                      </Text>

                      <View style={styles.kpiSpark}>
                        <Sparkline
                          data={sparkData}
                          width={70}
                          height={26}
                          color={k.color}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Charts Row */}

            <View
              style={[
                styles.chartsRow,
                compact && { flexDirection: "column" },
              ]}
            >
              <View style={[styles.card, styles.trendCard]}>
                <View style={styles.cardHead}>
                  <View>
                    <Text style={styles.cardTitle}>
                      Revenue Trend (7 days)
                    </Text>

                    <Text style={styles.cardSub}>
                      Daily completed revenue
                    </Text>
                  </View>

                  <View style={styles.pillLegend}>
                    <View style={styles.legendDot} />

                    <Text style={styles.legendText}>
                      Revenue ($)
                    </Text>
                  </View>
                </View>

                {analytics && (
                  <View style={{ position: "relative" }}>
                    <LineChart
                      data={analytics.days.map((d) => ({
                        label: d.label,
                        value: d.revenue,
                      }))}
                      width={chartWidth}
                      height={220}
                      color={colors.brand}
                    />

                    <View style={styles.xAxis}>
                      {analytics.days.map((d) => (
                        <Text
                          key={d.date}
                          style={styles.xLabel}
                        >
                          {d.label}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.card,
                  styles.donutCard,
                ]}
              >
                <View style={styles.cardHead}>
                  <View>
                    <Text style={styles.cardTitle}>
                      Status Split
                    </Text>

                    <Text style={styles.cardSub}>
                      This week
                    </Text>
                  </View>
                </View>

                {analytics && metrics && (
                  <View
                    style={{
                      alignItems: "center",
                      marginTop: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        position: "relative",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <DonutChart
                        size={170}
                        segments={[
                          {
                            value: metrics.completed,
                            color: colors.success,
                            label: "Completed",
                          },
                          {
                            value:
                              analytics.total_week -
                              metrics.completed -
                              metrics.cancelled -
                              metrics.no_shows,
                            color: colors.warning,
                            label: "Upcoming",
                          },
                          {
                            value: metrics.no_shows,
                            color: "#B0730B",
                            label: "No-Show",
                          },
                          {
                            value: metrics.cancelled,
                            color: colors.error,
                            label: "Cancelled",
                          },
                        ]}
                      />

                      <View style={styles.donutCenter}>
                        <Text
                          style={styles.donutCenterValue}
                        >
                          {analytics.total_week}
                        </Text>

                        <Text
                          style={styles.donutCenterLabel}
                        >
                          Total
                        </Text>
                      </View>
                    </View>

                    <View style={styles.donutLegend}>
                      <LegendRow
                        color={colors.success}
                        label="Completed"
                        value={metrics.completed}
                      />

                      <LegendRow
                        color={colors.warning}
                        label="Upcoming"
                        value={
                          analytics.total_week -
                          metrics.completed -
                          metrics.cancelled -
                          metrics.no_shows
                        }
                      />

                      <LegendRow
                        color="#B0730B"
                        label="No-Show"
                        value={metrics.no_shows}
                      />

                      <LegendRow
                        color={colors.error}
                        label="Cancelled"
                        value={metrics.cancelled}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Recent Bookings & Today's Schedule */}

            <View
              style={[
                styles.chartsRow,
                compact && { flexDirection: "column" },
              ]}
            >
              {/* ----------------------------------------
                  RECENT BOOKINGS
                  ---------------------------------------- */}

              <View
                style={[
                  styles.card,
                  styles.tableCard,
                ]}
              >
                <View style={styles.cardHead}>
                  <View>
                    <Text style={styles.cardTitle}>
                      Recent Bookings
                    </Text>

                    <Text style={styles.cardSub}>
                      Latest 6 bookings
                    </Text>
                  </View>
                </View>

                <View style={styles.tableHeader}>
                  <Text
                    style={[
                      styles.th,
                      { flex: 2 },
                    ]}
                  >
                    Client
                  </Text>

                  <Text
                    style={[
                      styles.th,
                      { flex: 1.2 },
                    ]}
                  >
                    Date
                  </Text>

                  <Text
                    style={[
                      styles.th,
                      { flex: 0.8 },
                    ]}
                  >
                    Price
                  </Text>

                  <Text
                    style={[
                      styles.th,
                      { flex: 1 },
                    ]}
                  >
                    Status
                  </Text>
                </View>

                {recent.map((b) => {
                  const st = badgeStyle(b.status);

                  return (
                    <View
                      key={b.id}
                      style={styles.tr}
                    >
                      <View
                        style={{
                          flex: 2,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <View style={styles.rowAvatar}>
                          <Text
                            style={styles.rowAvatarText}
                          >
                            {(b.name || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={styles.tdText}
                            numberOfLines={1}
                          >
                            {b.name}
                          </Text>

                          <Text style={styles.rowMeta}>
                            {b.phone || "—"}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flex: 1.2 }}>
                        <Text style={styles.tdText}>
                          {b.date}
                        </Text>

                        <Text style={styles.rowMeta}>
                          {b.time}
                        </Text>
                      </View>

                      <View style={{ flex: 0.8 }}>
                        <Text style={styles.tdText}>
                          {fmtMoney(b.price || 0)}
                        </Text>

                        {b.paid ? (
                          <Text
                            style={[
                              styles.rowMeta,
                              {
                                color: colors.success,
                              },
                            ]}
                          >
                            Paid
                          </Text>
                        ) : (
                          <Text
                            style={[
                              styles.rowMeta,
                              {
                                color: colors.warning,
                              },
                            ]}
                          >
                            Unpaid
                          </Text>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: st.bg,
                              alignSelf: "flex-start",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color: st.color,
                              },
                            ]}
                          >
                            {b.status.replace("_", "-")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {recent.length === 0 && (
                  <Text
                    style={{
                      padding: spacing.lg,
                      color: colors.muted,
                      textAlign: "center",
                    }}
                  >
                    No bookings yet
                  </Text>
                )}
              </View>

              {/* ----------------------------------------
                  TODAY'S SCHEDULE
                  ---------------------------------------- */}

              <View
                style={[
                  styles.card,
                  styles.todayCard,
                ]}
              >
                <View style={styles.cardHead}>
                  <View>
                    <Text style={styles.cardTitle}>
                      Today's Schedule
                    </Text>

                    <Text style={styles.cardSub}>
                      {todayList.length}{" "}
                      {todayList.length === 1
                        ? "booking"
                        : "bookings"}{" "}
                      today
                    </Text>
                  </View>
                </View>

                {todayList.length === 0 ? (
                  <View
                    style={{
                      padding: spacing.lg,
                      alignItems: "center",
                    }}
                  >
                    <Feather
                      name="calendar"
                      size={36}
                      color={colors.borderStrong}
                    />

                    <Text
                      style={{
                        color: colors.muted,
                        marginTop: 8,
                        fontSize: 13,
                      }}
                    >
                      No bookings scheduled today
                    </Text>
                  </View>
                ) : (
                  todayList.slice(0, 6).map((b) => {
                    const st = badgeStyle(b.status);

                    return (
                      <View
                        key={b.id}
                        style={styles.todayRow}
                      >
                        <View style={styles.timeBadge}>
                          <Text
                            style={styles.timeBadgeText}
                          >
                            {b.time}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text
                            style={styles.todayName}
                          >
                            {b.name}
                          </Text>

                          <Text
                            style={styles.todayPhone}
                          >
                            {b.phone || "—"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: st.bg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color: st.color,
                              },
                            ]}
                          >
                            {b.status.replace(
                              "_",
                              "-"
                            )}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.legendRow}>
      <View
        style={[
          styles.legendSquare,
          {
            backgroundColor: color,
          },
        ]}
      />

      <Text style={styles.legendLabel}>
        {label}
      </Text>

      <Text style={styles.legendValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xxl,
    paddingBottom: 60,
    gap: spacing.lg,
  },

  bannerRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },

  revenueBanner: {
    flex: 2,
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.lg,
    flexWrap: "wrap",
  },

  revenueLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    flex: 1,
    minWidth: 220,
  },

  revenueIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  revenueLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },

  revenueValue: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.onBrand,
    letterSpacing: -0.8,
    marginTop: 2,
  },

  revenuePipeline: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },

  revenueRight: {
    minWidth: 220,
    gap: 6,
  },

  revenueStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  revenueStatLabel: {
    flex: 1,
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },

  revenueStatValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onBrand,
  },

  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8CD0A0",
  },

  dotAmber: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F4C464",
  },

  paidBarWrap: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 6,
    overflow: "hidden",
  },

  paidBarFill: {
    height: "100%",
    backgroundColor: "#8CD0A0",
    borderRadius: 3,
  },

  paidPctText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },

  alertCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#F4E4C4",
    ...shadow.card,
  },

  alertHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },

  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: "#FFF4DE",
    alignItems: "center",
    justifyContent: "center",
  },

  alertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },

  alertValue: {
    fontSize: 30,
    fontWeight: "700",
    color: "#B0730B",
    letterSpacing: -0.5,
  },

  alertSub: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: spacing.sm,
  },

  alertRow: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },

  alertName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurface,
  },

  alertMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },

  alertMore: {
    fontSize: 11,
    color: colors.brand,
    fontWeight: "600",
    marginTop: 6,
  },

  kpiRow: {
    flexDirection: "row",
    gap: spacing.md,
    flexWrap: "wrap",
  },

  kpiCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  kpiHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },

  kpiLabel: {
    fontSize: 11,
    color: colors.muted,
    flex: 1,
    lineHeight: 14,
    fontWeight: "500",
  },

  kpiBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  kpiValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.onSurface,
    letterSpacing: -0.5,
  },

  kpiSpark: {
    opacity: 0.9,
  },

  chartsRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },

  trendCard: {
    flex: 2,
  },

  donutCard: {
    flex: 1,
    minWidth: 280,
  },

  tableCard: {
    flex: 2,
  },

  todayCard: {
    flex: 1,
    minWidth: 280,
  },

  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },

  cardSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },

  pillLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },

  legendText: {
    fontSize: 11,
    color: colors.onSurfaceTertiary,
    fontWeight: "500",
  },

  xAxis: {
    flexDirection: "row",
    paddingLeft: 36,
    paddingRight: 20,
    marginTop: -18,
  },

  xLabel: {
    flex: 1,
    fontSize: 10,
    color: colors.muted,
    textAlign: "center",
  },

  donutCenter: {
    position: "absolute",
    alignItems: "center",
  },

  donutCenterValue: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.onSurface,
  },

  donutCenterLabel: {
    fontSize: 11,
    color: colors.muted,
  },

  donutLegend: {
    marginTop: spacing.lg,
    width: "100%",
    gap: 6,
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 4,
  },

  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },

  legendLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },

  legendValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  th: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  tdText: {
    fontSize: 13,
    color: colors.onSurface,
    fontWeight: "500",
  },

  rowMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },

  rowAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  rowAvatarText: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 12,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  timeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },

  todayName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurface,
  },

  todayPhone: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
});