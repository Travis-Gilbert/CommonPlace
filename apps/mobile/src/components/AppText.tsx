import React from 'react';
import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MAX_FONT_SIZE_MULTIPLIER } from '@/theme/tokens';

type Variant = 'display1' | 'display2' | 'headline' | 'body' | 'sub' | 'caption' | 'micro';
type Tone = 'text' | 'muted' | 'faint' | 'primary' | 'onPrimary' | 'machine' | 'machineMuted';

export function AppText({
  variant = 'body',
  tone = 'text',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const t = useTheme();
  const color =
    tone === 'muted' ? t.c.textMuted
    : tone === 'faint' ? t.c.textFaint
    : tone === 'primary' ? t.c.primary
    : tone === 'onPrimary' ? t.c.onPrimary
    : tone === 'machine' ? t.machine.text
    : tone === 'machineMuted' ? t.machine.muted
    : t.c.text;
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      {...rest}
      style={[t.type[variant], { color }, style]}
    />
  );
}
