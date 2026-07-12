/**
 * ViewStateView, React Native mirror of
 * apps/web/src/components/commonplace/shared/ViewStateView.tsx. Renders a
 * five-state ViewState (../lib/viewState) and refines its loading branch
 * through the wait-tier ladder (../lib/waitTier):
 *
 *   empty    designed empty slot (honest, never a populated-looking fake)
 *   loading  T0 nothing, T1 skeleton slot, T2 WeaveSpinner plus one narrated line,
 *            T3 the same spinner today (WL-3 upgrades T3 to a backgroundable job card)
 *   partial  the data that already arrived, while the rest streams
 *   error    designed error with an optional retry
 *   success  the full data
 *
 * The children render prop receives (data, partial) so a surface can subtly mark
 * that more is still streaming without a second code path.
 */
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { WeaveSpinner } from '@/components/WeaveSpinner';
import type { ViewState } from '@/lib/viewState';
import { useWaitTier } from '@/lib/waitTier';
import { useTheme } from '@/theme/ThemeProvider';

export interface ViewStateViewProps<T> {
  readonly state: ViewState<T>;
  /** Known-shape skeleton for the T1 micro-state. Falls back to a plain block. */
  readonly skeleton?: ReactNode;
  /** Designed empty state. Falls back to a quiet honest line. */
  readonly empty?: ReactNode;
  /** One line of narrated intent for the T2/T3 spinner (pull from the WL-2 inventory). */
  readonly narration?: string;
  /** Accessible label for the operation (announced label + fallback empty copy). */
  readonly label?: string;
  /** Epoch ms the operation began, when it started before this mounted. */
  readonly startedAt?: number;
  readonly children: (data: T, partial: boolean) => ReactNode;
}

function DefaultSkeleton({ mutedColor }: { mutedColor: string }) {
  return (
    <View style={styles.skeletonWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skeletonRow, { backgroundColor: mutedColor, borderCurve: 'continuous' }]} />
      ))}
    </View>
  );
}

export function ViewStateView<T>({
  state,
  skeleton,
  empty,
  narration,
  label = 'Loading',
  startedAt,
  children,
}: ViewStateViewProps<T>) {
  const t = useTheme();
  // Hook called unconditionally; it stays at T0 unless the state is loading.
  const tier = useWaitTier(state.status === 'loading', startedAt);

  if (state.status === 'empty') {
    return (
      <>
        {empty ?? (
          <View style={styles.centered}>
            <AppText variant="caption" tone="muted">{`No ${label.toLowerCase()} yet.`}</AppText>
          </View>
        )}
      </>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.centered} accessibilityRole="alert">
        <AppText variant="sub">{state.message}</AppText>
        {state.retry ? (
          <Pressable
            onPress={state.retry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => [
              styles.retry,
              {
                backgroundColor: pressed ? t.c.primaryPressed : t.c.primary,
                borderCurve: 'continuous',
              },
            ]}
          >
            <AppText variant="caption" tone="onPrimary">
              Try again
            </AppText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state.status === 'loading') {
    if (tier === 'T0') return null;
    if (tier === 'T1') return <>{skeleton ?? <DefaultSkeleton mutedColor={t.c.muted} />}</>;
    // T2 and T3: WeaveSpinner plus one narrated line. WL-3 upgrades T3 to a
    // backgroundable job card streaming real harness_step events.
    return (
      <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite">
        <WeaveSpinner size={42} />
        {narration ? (
          <AppText variant="caption" tone="muted">
            {narration}
          </AppText>
        ) : null}
      </View>
    );
  }

  // partial or success: render the data, flagging whether more is still streaming.
  return <>{children(state.data, state.status === 'partial')}</>;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  retry: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  skeletonWrap: { gap: 8, padding: 8 },
  skeletonRow: { height: 44, borderRadius: 6 },
});

export default ViewStateView;
