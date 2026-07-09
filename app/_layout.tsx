import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Text } from 'react-native';
import { startSync } from '../lib/sync';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    startSync();
  }, []);

  // Native throws on unknown fontFamily; web just falls back until the
  // @font-face registers, so don't blank the screen there.
  if (!fontsLoaded && Platform.OS !== 'web') return null;

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#33302E',
          tabBarInactiveTintColor: '#B8B2AC',
          tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E8E3DA' },
          tabBarLabelStyle: { fontFamily: 'Nunito_700Bold' },
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
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.4 }}>🌱</Text>
            ),
          }}
        />
      </Tabs>
    </>
  );
}
