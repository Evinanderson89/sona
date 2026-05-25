import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { theme } from "../../lib/theme";

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? theme.colors.ink : theme.colors.inkFaint },
        ]}
      >
        {label}
      </Text>
      {focused ? <View style={styles.tabDot} /> : null}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.ink,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: theme.font.display,
          fontWeight: "600",
          fontSize: 16,
          letterSpacing: -0.2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 10,
          paddingBottom: 10,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabLabel label="Profile" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="talk"
        options={{
          title: "Talk",
          tabBarIcon: ({ focused }) => <TabLabel label="Talk" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="improv"
        options={{
          title: "Improv",
          tabBarIcon: ({ focused }) => <TabLabel label="Improv" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ focused }) => <TabLabel label="Journal" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 88,
    gap: 4,
  },
  tabLabel: {
    fontFamily: theme.font.body,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accent,
  },
});
