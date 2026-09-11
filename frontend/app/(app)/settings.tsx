import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import TopBar from "@/src/components/TopBar";
import { colors, spacing, radius, shadow } from "@/src/theme/tokens";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

const FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "check_availability", label: "Check Availability", hint: "Checks calendar for available slots" },
  { key: "book", label: "Book Appointment", hint: "Creates a new booking in Google Calendar" },
  { key: "reschedule", label: "Reschedule", hint: "Reschedules a booking + sends WhatsApp to client" },
  { key: "cancel", label: "Cancel Appointment", hint: "Cancels a booking + sends WhatsApp to client" },
  { key: "find_appointments", label: "Find Appointments", hint: "Syncs bookings from Google Sheet (auto every 2 min)" },
  { key: "reminder", label: "24h Reminder", hint: "Sends WhatsApp reminder ~24h before each appointment" },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const w = await api.getWebhooks();
        setValues(w);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateWebhooks(values);
      setMsg("✓ Settings saved successfully");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 2500);
    }
  };

  return (
    <View style={{ flex: 1 }} testID="settings-screen">
      <TopBar title="Settings" subtitle="Manage integrations and account preferences" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Account card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.sectionSub}>Signed in user</Text>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || "U"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
            <Pressable testID="settings-logout-btn" onPress={logout} style={styles.logoutBtn}>
              <Feather name="log-out" size={14} color={colors.error} />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        {/* Webhooks card */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.sectionTitle}>n8n Webhook Integrations</Text>
              <Text style={styles.sectionSub}>Configure your workflow endpoints. These are called by the CRM to trigger actions.</Text>
            </View>
            <View style={styles.badgeGood}>
              <Feather name="zap" size={12} color={colors.brand} />
              <Text style={styles.badgeGoodText}>Connected</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 20 }} />
          ) : (
            <View style={{ marginTop: spacing.md }}>
              {FIELDS.map((f) => (
                <View key={f.key} style={styles.fieldRow}>
                  <View style={styles.fieldLeft}>
                    <View style={styles.fieldIcon}>
                      <Feather name="link" size={14} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>{f.label}</Text>
                      <Text style={styles.fieldHint}>{f.hint}</Text>
                    </View>
                  </View>
                  <TextInput
                    testID={`webhook-input-${f.key}`}
                    style={styles.input}
                    value={values[f.key] || ""}
                    onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                    placeholder="https://..."
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
              <View style={styles.saveRow}>
                {msg && <Text style={styles.msg}>{msg}</Text>}
                <Pressable
                  testID="save-webhooks-btn"
                  onPress={save}
                  disabled={saving || loading}
                  style={[styles.saveBtn, (saving || loading) && { opacity: 0.7 }]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.onBrand} size="small" />
                  ) : (
                    <>
                      <Feather name="save" size={14} color={colors.onBrand} />
                      <Text style={styles.saveText}>Save Changes</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, paddingBottom: 60, gap: spacing.lg, maxWidth: 1100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  sectionSub: { fontSize: 12, color: colors.muted, marginTop: 4 },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrand, fontWeight: "700", fontSize: 18 },
  userName: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  userEmail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 36,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
  },
  logoutText: { fontSize: 13, color: colors.error, fontWeight: "600" },

  badgeGood: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  badgeGoodText: { fontSize: 11, color: colors.brand, fontWeight: "700" },

  fieldRow: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  fieldLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  fieldIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  fieldHint: { fontSize: 11, color: colors.muted, marginTop: 2 },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 12,
    color: colors.onSurface,
    backgroundColor: colors.canvas,
    fontFamily: "monospace" as any,
    outlineWidth: 0 as any,
  },
  saveRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  msg: { fontSize: 12, color: colors.brand, fontWeight: "600" },
  saveBtn: {
    height: 42,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveText: { color: colors.onBrand, fontWeight: "600", fontSize: 13 },
});
