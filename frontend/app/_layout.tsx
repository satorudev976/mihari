import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#fff" },
          headerTintColor: "#333",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "mihari" }} />
        <Stack.Screen name="link-line" options={{ title: "LINE連携" }} />
        <Stack.Screen name="filters" options={{ title: "フィルタ設定" }} />
        <Stack.Screen name="add-filter" options={{ title: "フィルタ追加" }} />
      </Stack>
    </>
  );
}
