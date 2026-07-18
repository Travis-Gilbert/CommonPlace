import React, { useState } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
};

/**
 * Pressable with a static style prop and explicit pointer-down state.
 *
 * NativeWind's JSX interop currently drops React Native's function-valued
 * Pressable style callback on the New Architecture. Keeping the prop static
 * preserves layout while retaining the same immediate pressed-state feedback.
 */
export function PressableSurface({
  style,
  pressedStyle,
  onPressIn,
  onPressOut,
  ...props
}: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...props}
      style={[style, pressed && pressedStyle]}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
    />
  );
}
