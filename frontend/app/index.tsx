import { Redirect } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { View, ActivityIndicator } from "react-native";
import { colors } from "@/src/theme/tokens";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }
  return <Redirect href={user ? "/(app)/dashboard" : "/login"} />;
}
