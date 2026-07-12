/**
 * CommonPlace mobile motion presets (HANDOFF-MOTION-TOKENS, mobile side).
 *
 * Two spring presets carry all gesture-driven and state-driven motion:
 * - springSnappy: controls (buttons, toggles, pills). Near-critical damping with a
 *   slight overshoot, so a press feels immediate but not stiff.
 * - springGentle: surfaces (sheets, panels, cards). Smoother settle, no overshoot bite.
 *
 * Springs, not timed tweens, drive anything a gesture can interrupt: a drag or a
 * pointer-down can retarget a spring mid-flight (the physics model just recomputes
 * from current position/velocity), where a withTiming duration-based tween has no
 * well-defined way to redirect without a visible snap.
 *
 * Reanimated 4 draws its bezier easings from two DIFFERENT types depending on the
 * animation driver, even for the same control points:
 * - JS-driven animations (withTiming, withDelay, ...) take an EasingFunctionFactory
 *   from Easing.bezier(x1, y1, x2, y2).
 * - CSS keyframe animations (animationTimingFunction on animationName-driven views,
 *   as used by WeaveSpinner) take a CSSTimingFunction from cubicBezier(x1, y1, x2, y2),
 *   a distinct class exported from react-native-reanimated's CSS module.
 * These two are not interchangeable: an Easing.bezier(...) result fails typecheck if
 * passed to animationTimingFunction (it has no normalize()/toString()). Both flavors
 * are exported below from the same control points so either driver can consume them.
 *
 * Mirrors motion.easeOut / motion.easeInOut / motion.easeExit in ./tokens.ts, which in
 * turn mirror apps/web/src/styles/commonplace-tokens.css --cp-ease-*.
 */
import { Easing, cubicBezier, type WithSpringConfig } from 'react-native-reanimated';

export const springSnappy: WithSpringConfig = {
  mass: 1,
  stiffness: 400,
  damping: 34,
};

export const springGentle: WithSpringConfig = {
  mass: 1,
  stiffness: 170,
  damping: 26,
};

// JS-driven (withTiming / withDelay) bezier eases.
export const easeOut = Easing.bezier(0.2, 0, 0, 1);
export const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
export const easeExit = Easing.bezier(0.3, 0, 1, 1);

// CSS-keyframe-driven (animationTimingFunction) equivalents, same control points.
export const cssEaseOut = cubicBezier(0.2, 0, 0, 1);
export const cssEaseInOut = cubicBezier(0.45, 0, 0.55, 1);
export const cssEaseExit = cubicBezier(0.3, 0, 1, 1);
