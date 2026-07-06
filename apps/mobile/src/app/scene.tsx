/**
 * Full-screen scene sheet: the Lane B page (gateway GET /scene/{id}) in a
 * WebView on the umber machine surface. Dismissing returns to the caller at
 * position; a WebView failure shows an honest state and never eats the answer.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { AppText } from '@/components/AppText';
import { WeaveSpinner } from '@/components/WeaveSpinner';
import { useTheme } from '@/theme/ThemeProvider';

export default function SceneScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { url } = useLocalSearchParams<{ url: string }>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: t.machine.ground }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <AppText variant="headline" tone="machine">
          Scene
        </AppText>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Close scene"
          hitSlop={12}
          style={({ pressed }) => [styles.close, { backgroundColor: pressed ? t.machine.raise : t.machine.mid, borderCurve: 'continuous' }]}
        >
          <Ionicons name="close" size={20} color={t.machine.text} />
        </Pressable>
      </View>
      {failed ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={28} color={t.machine.muted} />
          <AppText variant="sub" tone="machineMuted" style={{ textAlign: 'center' }}>
            The scene could not load. Your text answer is untouched in the thread.
          </AppText>
        </View>
      ) : (
        <>
          <WebView
            source={{ uri: url! }}
            style={styles.web}
            containerStyle={{ backgroundColor: t.machine.ground }}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            allowsBackForwardNavigationGestures={false}
            setSupportMultipleWindows={false}
          />
          {loading ? (
            <View style={[styles.center, styles.overlay]} pointerEvents="none">
              <WeaveSpinner size={120} color={t.accents.goldLight} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  web: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
