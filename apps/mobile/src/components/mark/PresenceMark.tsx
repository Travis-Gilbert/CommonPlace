import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';

export function PresenceMark({ active }: { active: boolean }) {
  const t = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.65));

  useEffect(() => {
    if (!active) {
      opacity.stopAnimation();
      opacity.setValue(0.65);
      return;
    }
    const motion = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 760, useNativeDriver: true }),
      ]),
    );
    motion.start();
    return () => motion.stop();
  }, [active, opacity]);

  return (
    <Animated.View
      accessibilityLabel={active ? 'Agent composing' : 'Agent present'}
      style={[styles.mark, { opacity }]}
    >
      <AppText
        variant="micro"
        style={{ color: t.speaker.agent, fontFamily: t.speakerFonts.machine, lineHeight: 8 }}
      >
        {active ? '· : ˙\n ˙ · :' : '· ˙ ·\n ˙ · '}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 34, height: 24, alignItems: 'center', justifyContent: 'center' },
});
