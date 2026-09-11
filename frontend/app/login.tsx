import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import { colors, spacing, radius, shadow } from "@/src/theme/tokens";
import { useAuth } from "@/src/context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState("admin@clinic.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWide = width >= 900;

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="login-screen">
      {isWide && (
        <View style={styles.hero}>
          <ImageBackground
            source={{ uri: "https://images.unsplash.com/photo-1762625570087-6d98fca29531?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTB8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBtaW5pbWFsaXN0JTIwZGVudGFsJTIwY2xpbmljJTIwaW50ZXJpb3J8ZW58MHx8fHwxNzg3NTg5MTQ2fDA&ixlib=rb-4.1.0&q=85" }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <LinearGradient colors={["rgba(60,90,68,0.55)", "rgba(26,26,24,0.9)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <View style={styles.logoBadgeBig}>
              <Feather name="activity" size={28} color={colors.onBrand} />
            </View>
            <Text style={styles.heroTitle}>ClinicFlow CRM</Text>
            <Text style={styles.heroSub}>
              A unified dashboard to manage every booking your AI voice agent creates — track deals, spot cancellations, reschedule with one click.
            </Text>
            <View style={styles.heroFeatures}>
              <FeatureLine text="Real-time sync from Google Sheets" />
              <FeatureLine text="Auto-derived booking status" />
              <FeatureLine text="One-click reschedule + WhatsApp" />
              <FeatureLine text="Weekly analytics & trends" />
            </View>
          </View>
        </View>
      )}

      <View style={styles.formSide}>
        <View style={styles.formCard}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Feather name="activity" size={18} color={colors.onBrand} />
            </View>
            <Text style={styles.brandName}>ClinicFlow</Text>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage your clinic's bookings</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@clinic.com"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
          />

          {error && (
            <Text testID="login-error" style={styles.errorText}>{error}</Text>
          )}

          <Pressable
            testID="login-submit-button"
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
          >
            {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.buttonText}>Sign In</Text>}
          </Pressable>

          <View style={styles.demoBox}>
            <Feather name="info" size={12} color={colors.brand} />
            <Text style={styles.demoText}>Demo: admin@clinic.com / admin123</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function FeatureLine({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
      <View style={styles.featureDot}>
        <Feather name="check" size={12} color={colors.onBrand} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row", backgroundColor: colors.canvas },
  hero: { flex: 1, position: "relative", overflow: "hidden" },
  heroContent: { flex: 1, padding: 48, justifyContent: "center" },
  logoBadgeBig: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  heroTitle: { fontSize: 40, fontWeight: "700", color: "#fff", letterSpacing: -1 },
  heroSub: { fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: spacing.md, lineHeight: 22, maxWidth: 480 },
  heroFeatures: { marginTop: spacing.xxl },
  featureDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  featureText: { color: "rgba(255,255,255,0.9)", fontSize: 14 },

  formSide: { width: 460, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  formCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  logoBadge: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  brandName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  title: { fontSize: 22, fontWeight: "700", color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: spacing.lg },
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
  errorText: { color: colors.error, fontSize: 12, marginTop: spacing.sm },
  button: {
    marginTop: spacing.xl,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.onBrand, fontSize: 14, fontWeight: "600" },
  demoBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, padding: spacing.sm, backgroundColor: colors.brandTertiary, borderRadius: radius.md, justifyContent: "center" },
  demoText: { fontSize: 11, color: colors.brand, fontWeight: "600" },
});
