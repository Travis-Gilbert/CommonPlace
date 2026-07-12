import '../global.css';

import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  useFonts,
} from '@expo-google-fonts/bricolage-grotesque';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { respondToApproval } from '@/api/harness';
import { editItem } from '@/api/queries';
import { drainQueue, setQueueCallbacks, startQueuePump } from '@/capture/queue';
import { Omnibar } from '@/components/omnibar/Omnibar';
import { OmnibarProvider, useOmnibar } from '@/components/omnibar/OmnibarContext';
import {
  presentRunFinished,
  registerForPush,
  scheduleReminder,
  setupNotificationCategories,
  snoozeReminder,
} from '@/notifications';
import { restoreQueryCache, startPersistingQueryCache } from '@/query/persistCache';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

/** Share sheet -> omnibar, pre-filled, capture confirmed on screen (D1). */
function ShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { open } = useOmnibar();
  useEffect(() => {
    if (!hasShareIntent) return;
    const file = shareIntent.files?.[0];
    open({
      prefill: {
        text: shareIntent.text ?? shareIntent.webUrl ?? '',
        kindHint: shareIntent.webUrl ? 'link' : file ? (file.mimeType?.startsWith('image/') ? 'image' : 'file') : undefined,
        attachmentUri: file?.path ?? undefined,
        attachmentMime: file?.mimeType ?? undefined,
        source: 'share',
      },
    });
    resetShareIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent]);
  return null;
}

/** Queue receipts, reminders, push registration, notification actions. */
function AppWiring() {
  useEffect(() => {
    setupNotificationCategories().catch(() => {});
    registerForPush().catch(() => {});
    startQueuePump();
    setQueueCallbacks({
      onFiled: (_row, item) => {
        // The capture haptic pair: success half fires on the filed receipt.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (item.remindAtMs) {
          void scheduleReminder({ itemId: item.id, title: item.title, remindAtMs: item.remindAtMs });
        }
      },
      onAnswered: (row, answer, note) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (row.notifyOnAnswer) {
          void presentRunFinished({
            title: 'Answer landed',
            body: answer.slice(0, 140),
            url: `/object/${note.id}`,
          });
        }
      },
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') void drainQueue();
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const action = response.actionIdentifier;
      if (action === 'approve' || action === 'deny') {
        const roomId = data.room_id as string | undefined;
        const approvalId = (data.approval_id as string | undefined) ?? (data.job_id as string | undefined);
        if (roomId && approvalId) void respondToApproval(roomId, approvalId, action === 'approve');
        return;
      }
      if (action === 'snooze' && typeof data.url === 'string') {
        const itemId = data.url.split('/').pop()!;
        void snoozeReminder(itemId, 'Reminder');
        return;
      }
      if (action === 'done' && typeof data.url === 'string') {
        const itemId = data.url.split('/').pop()!;
        void editItem({ id: itemId, status: 'done' }).catch(() => {});
        return;
      }
      if (typeof data.url === 'string') router.push(data.url as never);
    });
    return () => {
      appState.remove();
      responseSub.remove();
    };
  }, []);
  return null;
}

function ThemedStack() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.c.bg },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="object/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="room/[id]" />
      <Stack.Screen name="thread/[id]" />
      <Stack.Screen name="scene" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="account" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold });
  // Cache restore (D2.3): hydrate the query cache from disk before the splash
  // screen drops, so a cold launch paints the last-known feed on the first
  // frame instead of a blank/loading state. Queries revalidate afterward per
  // their normal staleTime.
  const [cacheRestored, setCacheRestored] = useState(false);
  useEffect(() => {
    restoreQueryCache(queryClient).finally(() => setCacheRestored(true));
  }, []);
  useEffect(() => {
    const stopPersisting = startPersistingQueryCache(queryClient);
    return stopPersisting;
  }, []);
  useEffect(() => {
    if (fontsLoaded && cacheRestored) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, cacheRestored]);
  if (!fontsLoaded || !cacheRestored) return null;
  return (
    <ShareIntentProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <OmnibarProvider>
            <AppWiring />
            <ShareIntentBridge />
            <ThemedStack />
            <Omnibar />
          </OmnibarProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ShareIntentProvider>
  );
}
