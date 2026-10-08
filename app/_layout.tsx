import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { productionBootstrap } from '@/src/bootstrap/production';
import { BootstrapGate } from '@/src/features/bootstrap/BootstrapGate';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <BootstrapGate bootstrap={productionBootstrap}>
      <RootStack />
    </BootstrapGate>
  );
}

function RootStack() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: '旅行' }} />
        <Stack.Screen name="trips/new" options={{ title: '创建旅行' }} />
        <Stack.Screen
          name="trips/[id]/index"
          options={{ title: '旅行详情' }}
        />
        <Stack.Screen
          name="trips/[id]/edit"
          options={{ title: '编辑旅行' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
