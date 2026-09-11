import React from "react";
import { View, StyleSheet } from "react-native";
import { Slot, Redirect } from "expo-router";
import Sidebar from "@/src/components/Sidebar";
import { colors } from "@/src/theme/tokens";
import { useAuth } from "@/src/context/AuthContext";

export default function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  if (!user) return <Redirect href="/login" />;

  return (
    <View style={styles.shell}>
      <Sidebar />
      <View style={styles.main}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: colors.canvas },
  main: { flex: 1, backgroundColor: colors.canvas },
});
