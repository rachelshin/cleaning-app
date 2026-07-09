import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#33302E',
          tabBarInactiveTintColor: '#B8B2AC',
          tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E8E3DA' },
          tabBarLabelStyle: { fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Wheel',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>🎡</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: 'Habits',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>🔥</Text>
            ),
          }}
        />
      </Tabs>
    </>
  );
}
