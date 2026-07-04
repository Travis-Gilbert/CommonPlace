/**
 * WeaveSpinner, React Native port (from WeaveSpinner.native.tsx).
 * Requires react-native-reanimated >= 4 (CSS animations) and expo-linear-gradient.
 *
 * Port notes vs the web original:
 * - CSS @keyframes -> Reanimated 4 CSS animations (animationName keyframe objects).
 * - Glow: animated `boxShadow` strings (animatable on both platforms, Android 9+).
 * - `perspective: 1200` lives inside each thread's transform array; threads are
 *   independent siblings so preserve-3d is not needed.
 * - Transform property order is identical across keyframes (Reanimated requirement).
 * - Default color is gold-light (--cp-gold-light #E0BC60), the machine-surface
 *   signal family. The loader belongs on umber machine surfaces.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cubicBezier,
  useReducedMotion,
  type CSSAnimationKeyframes,
} from 'react-native-reanimated';

type Props = {
  size?: number;
  color?: string; // hex
};

const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export function WeaveSpinner({ size = 160, color = '#E0BC60' }: Props) {
  const reduceMotion = useReducedMotion();
  const d = size / 160; // scale factor against the 160px reference design
  const glow60 = hexToRgba(color, 0.6);
  const glow80 = hexToRgba(color, 0.8);
  const glow50 = hexToRgba(color, 0.5);

  const nodePulse: CSSAnimationKeyframes = {
    from: {
      transform: [{ scale: 1 }],
      boxShadow: `0 0 ${20 * d}px ${color}, 0 0 ${40 * d}px ${glow60}`,
    },
    '50%': {
      transform: [{ scale: 1.4 }],
      boxShadow: `0 0 ${30 * d}px ${color}, 0 0 ${60 * d}px ${glow80}`,
    },
    to: {
      transform: [{ scale: 1 }],
      boxShadow: `0 0 ${20 * d}px ${color}, 0 0 ${40 * d}px ${glow60}`,
    },
  };

  const weave = (axis: 'x' | 'y', move: number, rotA: number, rotZ: number): CSSAnimationKeyframes => {
    const t = (m: number, ra: number, rz: number) =>
      axis === 'y'
        ? [{ perspective: 1200 }, { translateY: m }, { rotateX: `${ra}deg` }, { rotateZ: `${rz}deg` }]
        : [{ perspective: 1200 }, { translateX: m }, { rotateY: `${ra}deg` }, { rotateZ: `${rz}deg` }];
    return {
      from: { transform: t(0, 0, 0), opacity: 0.8 },
      '50%': { transform: t(move * d, rotA, rotZ), opacity: 1 },
      to: { transform: t(0, 0, 0), opacity: 0.8 },
    };
  };

  const threads = [
    { kf: weave('y', 40, 60, 20),   dur: 2000, ease: cubicBezier(0.45, 0, 0.55, 1),      style: { width: size, height: 2, top: size * 0.3, left: 0 },  horiz: true },
    { kf: weave('x', -40, 60, -20), dur: 2200, ease: cubicBezier(0.68, -0.55, 0.27, 1.55), style: { width: 2, height: size, top: 0, left: size * 0.7 }, horiz: false },
    { kf: weave('y', -40, -60, 15), dur: 2400, ease: cubicBezier(0.23, 1, 0.32, 1),       style: { width: size, height: 2, bottom: size * 0.3, left: 0 }, horiz: true },
    { kf: weave('x', 40, -60, -15), dur: 2600, ease: cubicBezier(0.36, 0, 0.66, -0.56),   style: { width: 2, height: size, top: 0, left: size * 0.3 },  horiz: false },
  ];

  if (reduceMotion) {
    return (
      <View style={[styles.wrapper, { width: size, height: size }]}>
        <View style={[styles.node, { backgroundColor: color, boxShadow: `0 0 ${20 * d}px ${color}` }]} />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {threads.map((th, i) => (
        <Animated.View
          key={i}
          style={[
            styles.thread,
            th.style,
            {
              boxShadow: `0 0 ${10 * d}px ${glow50}`,
              animationName: th.kf,
              animationDuration: th.dur,
              animationIterationCount: 'infinite',
              animationTimingFunction: th.ease,
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', glow80, 'transparent']}
            start={th.horiz ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
            end={th.horiz ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ))}
      <Animated.View
        style={[
          styles.node,
          {
            backgroundColor: color,
            animationName: nodePulse,
            animationDuration: 1600,
            animationIterationCount: 'infinite',
            animationTimingFunction: cubicBezier(0.68, -0.55, 0.27, 1.55),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  thread: { position: 'absolute', overflow: 'hidden' },
  node: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export default WeaveSpinner;
