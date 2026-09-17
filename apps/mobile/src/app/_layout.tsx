/**
 * RootLayout — injects SplashEntry (Natural AI-inspired) instead of BootSequence
 * Uses warm dark background throughout.
 */
import { Colors } from '../theme/colors';
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SplashEntry } from '../components/SplashEntry';
import { HandoffReceiver } from '../components/HandoffReceiver';
import { useHandoffBroadcast } from '../hooks/useHandoff';
import { useOrionStore } from '../store/useOrionStore';
import { useShareIntent } from 'expo-share-intent';
import { useEnvironmentNavigation } from '../hooks/useEnvironmentNavigation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Wrapper to initialize hooks that must live inside the component tree
function NavigationBridge() {
  useEnvironmentNavigation();
  return null;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

const LAST_OPENED_KEY = 'orion_last_opened_date';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isColdStart, setIsColdStart] = useState(true);
  const { handlePushNotification } = useOrionStore();

  // Hardcoded user ID for testing the magic handoff
  useHandoffBroadcast("89a5843a-23b6-411a-ab60-123456789abc", pathname, new URLSearchParams(params as any).toString());

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (isReady && !showSplash && hasShareIntent && (shareIntent as any)?.value) {
      router.push({
        pathname: '/time-worth' as any,
        params: { url: (shareIntent as any).value }
      });
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, isReady, showSplash, router, resetShareIntent]);

  useEffect(() => {
    async function prepare() {
      try {
        const today = new Date().toDateString();
        const lastOpened = await AsyncStorage.getItem(LAST_OPENED_KEY);
        if (lastOpened === today) {
          setIsColdStart(false);
        } else {
          setIsColdStart(true);
          await AsyncStorage.setItem(LAST_OPENED_KEY, today);
        }
        setIsReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      } catch (err) {
        setIsReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    prepare();
  }, []);

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <NavigationBridge />
        
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 260,
            contentStyle: { backgroundColor: Colors.bg },
          }}
        />
        
        {/* Magic Handoff Global Overlay */}
        <HandoffReceiver />

        {showSplash && (
          <SplashEntry
            isColdStart={isColdStart}
            onComplete={async () => {
              setShowSplash(false);
              const onboarded = await AsyncStorage.getItem('orion_onboarded');
              if (onboarded !== 'true') {
                router.replace('/onboarding');
              }
            }}
          />
        )}
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}
