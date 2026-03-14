import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Keep splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    // TODO: Load fonts, check auth state, then hide splash
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="transactions/[id]"
              options={{
                presentation: 'modal',
                headerShown: true,
                headerTitle: 'Transaction',
                headerStyle: { backgroundColor: '#0F0F14' },
                headerTintColor: '#FFFFFF',
              }}
            />
            <Stack.Screen
              name="link-account"
              options={{
                presentation: 'modal',
                headerShown: true,
                headerTitle: 'Link Account',
                headerStyle: { backgroundColor: '#0F0F14' },
                headerTintColor: '#FFFFFF',
              }}
            />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
