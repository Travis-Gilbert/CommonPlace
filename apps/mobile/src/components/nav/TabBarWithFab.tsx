/**
 * The bottom row: tab pill (Index, Chat, Commonplaces, Data) left, detached
 * 56pt capture FAB right in the thumb zone (Linear/Plane anatomy). iOS pill is
 * expo-blur; Android falls back to an 85% surface tint. No badges, ever.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useOmnibar } from '@/components/omnibar/OmnibarContext';
import { useTheme } from '@/theme/ThemeProvider';

const TAB_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'list-outline',
  chat: 'chatbubble-outline',
  commonplaces: 'people-outline',
  data: 'albums-outline',
};
const TAB_ICON_ACTIVE: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'list',
  chat: 'chatbubble',
  commonplaces: 'people',
  data: 'albums',
};
const TAB_LABEL: Record<string, string> = {
  index: 'Index',
  chat: 'Chat',
  commonplaces: 'Commonplaces',
  data: 'Data',
};

/* Structural subset of BottomTabBarProps: expo-router vendors its own
   bottom-tabs types, so importing the package type creates a version clash. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function TabBarWithFab({ state, navigation }: TabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { open } = useOmnibar();

  const pillInner = (
    <View style={styles.pillInner}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const name = route.name;
        // Press-down activation (SPEC-UX-PHYSICS D5): a tab switch is idempotent, so
        // it fires on press-in for a crisp flip. onPress keeps assistive-tech
        // activation working; navigating to the same route is a no-op, so the two
        // paths cannot double-switch.
        const activate = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={TAB_LABEL[name] ?? name}
            onPressIn={activate}
            onPress={activate}
            style={styles.tab}
          >
            <Ionicons
              name={focused ? (TAB_ICON_ACTIVE[name] ?? 'ellipse') : (TAB_ICON[name] ?? 'ellipse-outline')}
              size={22}
              color={focused ? t.c.primary : t.c.textMuted}
            />
            <AppText variant="micro" style={{ color: focused ? t.c.primary : t.c.textMuted }} numberOfLines={1}>
              {TAB_LABEL[name] ?? name}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View
        style={[
          styles.pill,
          {
            borderColor: t.c.border,
            height: t.layout.tabPillHeight,
            borderCurve: 'continuous',
            boxShadow: t.contactShadow || undefined,
            backgroundColor: Platform.OS === 'ios' ? 'transparent' : `${t.c.surface}D9`, // 85% tint fallback
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={70}
            tint={t.scheme === 'dark' ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, styles.pillBlur]}
          >
            {pillInner}
          </BlurView>
        ) : (
          pillInner
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Capture"
        accessibilityHint="Opens the omnibar. Long press to capture by voice."
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          open();
        }}
        onLongPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          open({ voice: true });
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            width: t.layout.fabSize,
            height: t.layout.fabSize,
            borderRadius: t.layout.fabSize / 2,
            backgroundColor: pressed ? t.c.primaryPressed : t.c.primary,
            borderCurve: 'continuous',
            boxShadow: t.contactShadow || undefined,
          },
        ]}
      >
        <Ionicons name="add" size={28} color={t.c.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  pill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pillBlur: { borderRadius: 999 },
  pillInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: '100%' },
  fab: { alignItems: 'center', justifyContent: 'center' },
});
