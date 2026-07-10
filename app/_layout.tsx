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
          tabBarActiveTintColor: '#5E8A44',
          tabBarInactiveTintColor: '#C9BBA3',
          tabBarStyle: {
            backgroundColor: '#FCF6EA',
            borderTopColor: '#F1E7D3',
            height: 74,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 12 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Wheel',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>🎡</Text>
            ),
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: 'Habits',
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>🌱</Text>
            ),
          }}
        />
      </Tabs>
    </>
  );
}
