import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { theme } from "../lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="practice"
          options={{ title: "Practice Arena" }}
        />
        <Stack.Screen
          name="calibrate"
          options={{ title: "", headerBackVisible: false }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
