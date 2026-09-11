import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useRouter } from "expo-router";
import TopBar from "@/src/components/TopBar";
import { colors, spacing, radius, shadow } from "@/src/theme/tokens";
import { api } from "@/src/api/client";

type Booking = {
  id: string; name: string; phone: string; date: string; time: string;
  event_id?: string; status: string;
  notes?: string; price?: number; paid?: boolean;
  service_type?: string; reminder_sent?: boolean;
};
type SortKey = "name" | "date" | "status";

const STATUS_CHIPS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "no_show", label: "No-Show" },
  { key: "cancelled", label: "Cancelled" },
];

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

const fmtMoney = (v?: number) => `$${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const SERVICE_OPTIONS = [
  "General", "Consultation", "Cleaning", "Filling",
  "Root Canal", "Extraction", "Whitening", "Crown", "Braces", "Other",
];

export default function BookingsPage() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [mode, setMode] = useState<"detail" | "reschedule">("detail");
  const [rDate, setRDate] = useState("");
  const [rTime, setRTime] = useState("");
  const [notes, setNotes] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [paid, setPaid] = useState(false);
  const [service, setService] = useState("General");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Create-booking modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cDate, setCDate] = useState(new Date().toISOString().slice(0, 10));
  const [cTime, setCTime] = useState("10:00");
  const [cService, setCService] = useState("General");
  const [cPriceStr, setCPriceStr] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const openCreate = () => {
    setCName("");
    setCPhone("");
    setCDate(new Date().toISOString().slice(0, 10));
    setCTime("10:00");
    setCService("General");
    setCPriceStr("");
    setCNotes("");
    setCreateMsg(null);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!cName.trim() || !cPhone.trim() || !cDate || !cTime) {
      setCreateMsg("Name, phone, date and time are required");
      return;
    }
    setCreating(true);
    setCreateMsg(null);
    try {
      const p = parseFloat(cPriceStr);
      await api.createBooking({
        name: cName.trim(),
        phone: cPhone.trim(),
        date: cDate,
        time: cTime,
        service_type: cService,
        price: isNaN(p) ? 0 : p,
        notes: cNotes,
      });
      setCreateMsg("✓ Booking created");
      await load();
      setTimeout(() => setCreateOpen(false), 800);
    } catch (e: any) {
      setCreateMsg(e?.message || "Failed to create booking");
    } finally {
      setCreating(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const r = await api.bookings({ status: statusFilter, search: search.trim() || undefined });
      setBookings(r.bookings);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const sorted = useMemo(() => {
    const arr = [...bookings];
    arr.sort((a, b) => {
      const av = (a[sortKey] || "").toString();
      const bv = (b[sortKey] || "").toString();
      if (sortKey === "date") {
        const ax = `${a.date} ${a.time}`;
        const bx = `${b.date} ${b.time}`;
        return sortDir === "asc" ? ax.localeCompare(bx) : bx.localeCompare(ax);
      }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return arr;
  }, [bookings, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const open = (b: Booking) => {
    setSelected(b);
    setMode("detail");
    setNotes(b.notes || "");
    setPriceStr(String(b.price ?? ""));
    setPaid(!!b.paid);
    setService(b.service_type || "General");
    setActionMsg(null);
  };
  const close = () => {
    setSelected(null);
    setActionMsg(null);
  };

  const savePatch = async () => {
    if (!selected) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const p = parseFloat(priceStr);
      await api.patchBooking(selected.id, {
        notes,
        price: isNaN(p) ? 0 : p,
        paid,
        service_type: service,
      });
      setActionMsg("✓ Saved");
      await load();
      setTimeout(() => setActionMsg(null), 1500);
    } catch (e: any) {
      setActionMsg(e?.message || "Failed to save");
    } finally {
      setActionLoading(false);
    }
  };

  const sendReminder = async () => {
    if (!selected) return;
    setSendingReminder(true);
    setActionMsg(null);
    try {
      const r = await api.sendReminder(selected.id);
      if (r?.webhook?.ok) {
        setActionMsg("✓ Reminder sent");
      } else {
        setActionMsg(r?.webhook?.error === "webhook_not_configured"
          ? "Configure the Reminder webhook in Settings"
          : "Reminder webhook failed");
      }
      await load();
    } catch (e: any) {
      setActionMsg(e?.message || "Failed");
    } finally {
      setSendingReminder(false);
      setTimeout(() => setActionMsg(null), 2500);
    }
  };

  const doStatus = async (status: string) => {
    if (!selected) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      await api.updateStatus(selected.id, status);
      setActionMsg(`Marked ${status}`);
      await load();
      setTimeout(close, 700);
    } catch (e: any) {
      setActionMsg(e?.message || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const doReschedule = async () => {
    if (!selected || !rDate || !rTime) {
      setActionMsg("Enter date & time");
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      await api.reschedule(selected.id, rDate, rTime);
      setActionMsg("Rescheduled — WhatsApp will be sent");
      await load();
      setTimeout(close, 1100);
    } catch (e: any) {
      setActionMsg(e?.message || "Failed");
    } finally {
      setActionLoading(false);
    }
  };

  const openReschedule = () => {
    if (!selected) return;
    setRDate(selected.date);
    setRTime(selected.time);
    setMode("reschedule");
    setActionMsg(null);
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      await api.sync();
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const compact = width < 1100;

  return (
    <View style={{ flex: 1 }} testID="bookings-screen">
      <TopBar
        title="Bookings"
        subtitle={`${bookings.length} total bookings`}
        search={search}
        onSearchChange={setSearch}
        onSync={runSync}
        syncing={syncing}
        rightExtra={
          <Pressable
            testID="new-booking-btn"
            onPress={openCreate}
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
          >
            <Feather name="plus" size={14} color={colors.onBrand} />
            <Text style={styles.newBtnText}>New Booking</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.filterBar}>
            <View style={styles.chipRow}>
              {STATUS_CHIPS.map((c) => {
                const active = statusFilter === c.key;
                const cnt = c.key === "all" ? bookings.length : bookings.filter((b) => b.status === c.key).length;
                return (
                  <Pressable
                    key={c.key}
                    testID={`filter-chip-${c.key}`}
                    onPress={() => setStatusFilter(c.key)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                    <View style={[styles.chipCount, active && styles.chipCountActive]}>
                      <Text style={[styles.chipCountText, active && { color: colors.onBrand }]}>{cnt}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Table */}
          <View style={styles.tableHeader}>
            <Pressable onPress={() => toggleSort("name")} style={[styles.thWrap, { flex: 2 }]}>
              <Text style={styles.th}>Client</Text>
              <SortIcon active={sortKey === "name"} dir={sortDir} />
            </Pressable>
            {!compact && <Text style={[styles.th, { flex: 1.4 }]}>Phone</Text>}
            <Pressable onPress={() => toggleSort("date")} style={[styles.thWrap, { flex: 1.3 }]}>
              <Text style={styles.th}>Date & Time</Text>
              <SortIcon active={sortKey === "date"} dir={sortDir} />
            </Pressable>
            <Pressable onPress={() => toggleSort("status")} style={[styles.thWrap, { flex: 1 }]}>
              <Text style={styles.th}>Status</Text>
              <SortIcon active={sortKey === "status"} dir={sortDir} />
            </Pressable>
            <Text style={[styles.th, { width: 90, textAlign: "right" }]}>Actions</Text>
          </View>

          {loading ? (
            <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : sorted.length === 0 ? (
            <View style={{ padding: spacing.xxxl, alignItems: "center" }}>
              <Feather name="calendar" size={40} color={colors.borderStrong} />
              <Text style={{ color: colors.muted, marginTop: 10, fontSize: 13 }}>No bookings match your filters</Text>
            </View>
          ) : (
            sorted.map((b) => {
              const st = badgeStyle(b.status);
              return (
                <Pressable
                  key={b.id}
                  testID={`booking-row-${b.id}`}
                  onPress={() => open(b)}
                  style={({ pressed }) => [styles.tr, pressed && { backgroundColor: colors.canvas }]}
                >
                  <View style={[{ flex: 2, flexDirection: "row", alignItems: "center", gap: 12 }]}>
                    <View style={styles.rowAvatar}>
                      <Text style={styles.rowAvatarText}>{(b.name || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{b.name}</Text>
                      {b.service_type && b.service_type !== "General" ? (
                        <View style={styles.tableServicePill}>
                          <Text style={styles.tableServicePillText}>{b.service_type}</Text>
                        </View>
                      ) : compact ? (
                        <Text style={styles.rowMeta}>{b.phone || "—"}</Text>
                      ) : null}
                    </View>
                  </View>
                  {!compact && <Text style={[styles.tdText, { flex: 1.4 }]}>{b.phone || "—"}</Text>}
                  <View style={{ flex: 1.3 }}>
                    <Text style={styles.tdText}>{b.date}</Text>
                    <Text style={styles.rowMeta}>{b.time}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.badge, { backgroundColor: st.bg, alignSelf: "flex-start" }]}>
                      <Text style={[styles.badgeText, { color: st.color }]}>{b.status.replace("_", "-")}</Text>
                    </View>
                  </View>
                  <View style={{ width: 90, flexDirection: "row", justifyContent: "flex-end", gap: 6 }}>
                    <Feather name="chevron-right" size={16} color={colors.muted} />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.modal} testID="booking-detail-modal">
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>
                  {mode === "reschedule" ? "Reschedule" : "Booking Details"}
                </Text>
                <Pressable onPress={close} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.muted} />
                </Pressable>
              </View>

              {selected && mode === "detail" && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalRow}>
                    <View style={styles.rowAvatarLg}>
                      <Text style={styles.rowAvatarLgText}>{(selected.name || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalName}>{selected.name}</Text>
                      <Text style={styles.modalMeta}>{selected.phone || "No phone"}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: badgeStyle(selected.status).bg }]}>
                      <Text style={[styles.badgeText, { color: badgeStyle(selected.status).color }]}>
                        {selected.status.replace("_", "-")}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailGrid}>
                    <DetailCell label="Date" value={selected.date} icon="calendar" />
                    <DetailCell label="Time" value={selected.time} icon="clock" />
                  </View>

                  {/* Revenue */}
                  <Text style={styles.sectionLabel}>Revenue</Text>
                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Price ($)</Text>
                      <TextInput
                        testID="booking-price-input"
                        style={styles.input}
                        value={priceStr}
                        onChangeText={setPriceStr}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Payment status</Text>
                      <View style={styles.toggleRow}>
                        <Pressable
                          testID="paid-toggle-paid"
                          onPress={() => setPaid(true)}
                          style={[styles.toggleBtn, paid && styles.toggleBtnActivePaid]}
                        >
                          <Feather name="check-circle" size={12} color={paid ? colors.onBrand : colors.muted} />
                          <Text style={[styles.toggleText, paid && { color: colors.onBrand }]}>Paid</Text>
                        </Pressable>
                        <Pressable
                          testID="paid-toggle-unpaid"
                          onPress={() => setPaid(false)}
                          style={[styles.toggleBtn, !paid && styles.toggleBtnActiveUnpaid]}
                        >
                          <Feather name="circle" size={12} color={!paid ? "#fff" : colors.muted} />
                          <Text style={[styles.toggleText, !paid && { color: "#fff" }]}>Unpaid</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Service Type */}
                  <Text style={styles.sectionLabel}>Service Type</Text>
                  <View style={styles.serviceGrid}>
                    {SERVICE_OPTIONS.map((s) => (
                      <Pressable
                        key={s}
                        testID={`service-chip-${s}`}
                        onPress={() => setService(s)}
                        style={[styles.serviceChip, service === s && styles.serviceChipActive]}
                      >
                        <Text style={[styles.serviceChipText, service === s && styles.serviceChipTextActive]}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Notes */}
                  <Text style={styles.sectionLabel}>Client Notes</Text>
                  <TextInput
                    testID="booking-notes-input"
                    style={[styles.input, { height: 90, paddingTop: 10, textAlignVertical: "top" }]}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder="Add patient concerns, treatment history, or reminders..."
                    placeholderTextColor={colors.muted}
                  />
                  <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" }}>
                    <Pressable
                      testID="save-details-btn"
                      onPress={savePatch}
                      disabled={actionLoading}
                      style={[styles.saveDetailsBtn, actionLoading && { opacity: 0.7 }]}
                    >
                      <Feather name="save" size={12} color={colors.brand} />
                      <Text style={styles.saveDetailsText}>Save details</Text>
                    </Pressable>
                    <Pressable
                      testID="view-profile-btn"
                      onPress={() => {
                        const phDigits = (selected.phone || "").replace(/\D/g, "");
                        const key = phDigits ? `ph:${phDigits}` : `nm:${(selected.name || "").trim().toLowerCase()}`;
                        close();
                        router.push(`/(app)/client/${encodeURIComponent(key)}` as any);
                      }}
                      style={styles.saveDetailsBtn}
                    >
                      <Feather name="user" size={12} color={colors.brand} />
                      <Text style={styles.saveDetailsText}>View client profile</Text>
                    </Pressable>
                    {selected.status === "upcoming" && (
                      <Pressable
                        testID="send-reminder-btn"
                        onPress={sendReminder}
                        disabled={sendingReminder}
                        style={[styles.saveDetailsBtn, { backgroundColor: "#FFF4DE" }, sendingReminder && { opacity: 0.7 }]}
                      >
                        {sendingReminder ? (
                          <ActivityIndicator size="small" color="#B0730B" />
                        ) : (
                          <Feather name="send" size={12} color="#B0730B" />
                        )}
                        <Text style={[styles.saveDetailsText, { color: "#B0730B" }]}>
                          {selected.reminder_sent ? "Resend WhatsApp" : "Send WhatsApp reminder"}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Status actions */}
                  <Text style={styles.sectionLabel}>Status Actions</Text>
                  <View style={styles.actionRow}>
                    <Pressable
                      testID="mark-completed-btn"
                      onPress={() => doStatus("completed")}
                      disabled={actionLoading}
                      style={[styles.actionBtn, { backgroundColor: colors.brand }]}
                    >
                      <Feather name="check" size={14} color={colors.onBrand} />
                      <Text style={styles.actionBtnText}>Complete</Text>
                    </Pressable>
                    <Pressable
                      testID="mark-no-show-btn"
                      onPress={() => doStatus("no_show")}
                      disabled={actionLoading}
                      style={[styles.actionBtn, { backgroundColor: "#B0730B" }]}
                    >
                      <Feather name="alert-triangle" size={14} color="#fff" />
                      <Text style={styles.actionBtnText}>No-Show</Text>
                    </Pressable>
                    <Pressable
                      testID="cancel-booking-btn"
                      onPress={() => doStatus("cancelled")}
                      disabled={actionLoading}
                      style={[styles.actionBtn, { backgroundColor: colors.error }]}
                    >
                      <Feather name="x" size={14} color="#fff" />
                      <Text style={styles.actionBtnText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      testID="reschedule-btn"
                      onPress={openReschedule}
                      style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand }]}
                    >
                      <Feather name="calendar" size={14} color={colors.brand} />
                      <Text style={[styles.actionBtnText, { color: colors.brand }]}>Reschedule</Text>
                    </Pressable>
                  </View>
                  {actionLoading && <ActivityIndicator color={colors.brand} style={{ marginTop: 10 }} />}
                  {actionMsg && <Text style={styles.actionMsg}>{actionMsg}</Text>}
                </ScrollView>
              )}

              {selected && mode === "reschedule" && (
                <>
                  <Text style={styles.modalName}>{selected.name}</Text>
                  <Text style={styles.modalMeta}>{selected.phone}</Text>
                  <Text style={styles.label}>New Date (YYYY-MM-DD)</Text>
                  <TextInput
                    testID="reschedule-date-input"
                    style={styles.input}
                    value={rDate}
                    onChangeText={setRDate}
                    placeholder="2026-09-15"
                    placeholderTextColor={colors.muted}
                  />
                  <Text style={styles.label}>New Time (HH:MM)</Text>
                  <TextInput
                    testID="reschedule-time-input"
                    style={styles.input}
                    value={rTime}
                    onChangeText={setRTime}
                    placeholder="14:30"
                    placeholderTextColor={colors.muted}
                  />
                  <View style={styles.actionRow}>
                    <Pressable onPress={() => setMode("detail")} style={[styles.actionBtn, { backgroundColor: colors.canvas, flex: 1 }]}>
                      <Text style={[styles.actionBtnText, { color: colors.onSurfaceSecondary }]}>Back</Text>
                    </Pressable>
                    <Pressable
                      testID="reschedule-submit-btn"
                      onPress={doReschedule}
                      disabled={actionLoading}
                      style={[styles.actionBtn, { backgroundColor: colors.brand, flex: 2 }]}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color={colors.onBrand} />
                      ) : (
                        <Text style={styles.actionBtnText}>Confirm & Send WhatsApp</Text>
                      )}
                    </Pressable>
                  </View>
                  {actionMsg && <Text style={styles.actionMsg}>{actionMsg}</Text>}
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Create Booking Modal */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreateOpen(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.modal} testID="create-booking-modal">
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>New Booking</Text>
                <Pressable onPress={() => setCreateOpen(false)} hitSlop={8}>
                  <Feather name="x" size={20} color={colors.muted} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Client</Text>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  testID="create-name-input"
                  style={styles.input}
                  value={cName}
                  onChangeText={setCName}
                  placeholder="e.g. Sarah Johnson"
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  testID="create-phone-input"
                  style={styles.input}
                  value={cPhone}
                  onChangeText={setCPhone}
                  placeholder="e.g. 9419420501"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />

                <Text style={styles.sectionLabel}>Appointment</Text>
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                    <TextInput
                      testID="create-date-input"
                      style={styles.input}
                      value={cDate}
                      onChangeText={setCDate}
                      placeholder="2026-09-20"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Time (HH:MM)</Text>
                    <TextInput
                      testID="create-time-input"
                      style={styles.input}
                      value={cTime}
                      onChangeText={setCTime}
                      placeholder="14:30"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <Text style={styles.sectionLabel}>Service Type</Text>
                <View style={styles.serviceGrid}>
                  {SERVICE_OPTIONS.map((s) => (
                    <Pressable
                      key={s}
                      testID={`create-service-${s}`}
                      onPress={() => setCService(s)}
                      style={[styles.serviceChip, cService === s && styles.serviceChipActive]}
                    >
                      <Text style={[styles.serviceChipText, cService === s && styles.serviceChipTextActive]}>{s}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Price ($) — optional</Text>
                <TextInput
                  testID="create-price-input"
                  style={styles.input}
                  value={cPriceStr}
                  onChangeText={setCPriceStr}
                  placeholder="150"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Notes — optional</Text>
                <TextInput
                  testID="create-notes-input"
                  style={[styles.input, { height: 70, paddingTop: 10, textAlignVertical: "top" }]}
                  value={cNotes}
                  onChangeText={setCNotes}
                  multiline
                  placeholder="Any notes about this walk-in..."
                  placeholderTextColor={colors.muted}
                />

                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
                  <Pressable onPress={() => setCreateOpen(false)} style={[styles.actionBtn, { backgroundColor: colors.canvas, flex: 1 }]}>
                    <Text style={[styles.actionBtnText, { color: colors.onSurfaceSecondary }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    testID="create-submit-btn"
                    onPress={submitCreate}
                    disabled={creating}
                    style={[styles.actionBtn, { backgroundColor: colors.brand, flex: 2 }, creating && { opacity: 0.7 }]}
                  >
                    {creating ? (
                      <ActivityIndicator color={colors.onBrand} />
                    ) : (
                      <>
                        <Feather name="plus" size={14} color={colors.onBrand} />
                        <Text style={styles.actionBtnText}>Create Booking</Text>
                      </>
                    )}
                  </Pressable>
                </View>
                {createMsg && <Text style={styles.actionMsg}>{createMsg}</Text>}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <Feather name="chevrons-up-down" size={12} color={colors.mutedLight} />;
  return <Feather name={dir === "asc" ? "chevron-up" : "chevron-down"} size={12} color={colors.brand} />;
}

function DetailCell({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.detailCell}>
      <View style={styles.detailIcon}>
        <Feather name={icon} size={14} color={colors.brand} />
      </View>
      <View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, paddingBottom: 60 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  filterBar: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  chipRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.onBrand },
  chipCount: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.surface, minWidth: 22, alignItems: "center" },
  chipCountActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  chipCountText: { fontSize: 10, color: colors.muted, fontWeight: "700" },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  thWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  th: { fontSize: 11, color: colors.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tdText: { fontSize: 13, color: colors.onSurface },
  rowAvatar: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowAvatarText: { color: colors.brand, fontWeight: "700", fontSize: 13 },
  rowName: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },

  backdrop: { flex: 1, backgroundColor: "rgba(15,15,14,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: 520,
    maxWidth: "100%",
    maxHeight: "90%",
  },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  modalRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  rowAvatarLg: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowAvatarLgText: { color: colors.brand, fontWeight: "700", fontSize: 20 },
  modalName: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  modalMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },

  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg },
  detailCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    minWidth: "47%",
  },
  detailIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  detailLabel: { fontSize: 11, color: colors.muted },
  detailValue: { fontSize: 13, color: colors.onSurface, fontWeight: "600", marginTop: 2 },

  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  actionBtn: { flex: 1, minWidth: 100, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, paddingHorizontal: spacing.md },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  actionMsg: { textAlign: "center", marginTop: spacing.md, fontSize: 12, color: colors.onSurfaceSecondary },

  sectionLabel: { fontSize: 11, color: colors.mutedLight, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7, marginTop: spacing.lg, marginBottom: spacing.sm },
  toggleRow: { flexDirection: "row", height: 40, borderRadius: radius.md, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border, padding: 3, gap: 3 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: radius.sm },
  toggleBtnActivePaid: { backgroundColor: colors.brand },
  toggleBtnActiveUnpaid: { backgroundColor: colors.warning },
  toggleText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  saveDetailsBtn: {
    marginTop: spacing.sm,
    height: 32,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTertiary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveDetailsText: { fontSize: 11, color: colors.brand, fontWeight: "700" },

  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  serviceChip: {
    paddingHorizontal: 12, height: 30, borderRadius: radius.pill,
    backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  serviceChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  serviceChipText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  serviceChipTextActive: { color: colors.onBrand },

  tableServicePill: {
    alignSelf: "flex-start",
    marginTop: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.brandTertiary,
  },
  tableServicePillText: { fontSize: 10, color: colors.brand, fontWeight: "600" },

  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, height: 38, borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  newBtnText: { fontSize: 13, color: colors.onBrand, fontWeight: "600" },

  label: { fontSize: 12, color: colors.onSurfaceTertiary, fontWeight: "600", marginTop: spacing.md, marginBottom: 6 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.canvas,
    outlineWidth: 0 as any,
  },
});
