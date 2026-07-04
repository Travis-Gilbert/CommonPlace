import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import {
  accents,
  contactShadow,
  darkColors,
  kindColors,
  layout,
  lightColors,
  machineDeepTeal,
  machineUmber,
  motion,
  oxblood,
  radius,
  space,
  type,
  type MachineColors,
  type SchemeColors,
} from './tokens';

export type ThemePrefs = {
  /** Machine-surface family; umber stays the default. */
  machineSurface: 'umber' | 'deepTeal';
};

export type Theme = {
  scheme: 'light' | 'dark';
  c: SchemeColors;
  machine: MachineColors;
  accents: typeof accents;
  kindColors: typeof kindColors;
  oxblood: typeof oxblood;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  motion: typeof motion;
  layout: typeof layout;
  /** Light mode only; empty string in dark (depth by tone, not shadow). */
  contactShadow: string;
};

const PREFS_KEY = 'commonplace:mobile:theme-prefs:v1';

const ThemeContext = createContext<{
  theme: Theme;
  prefs: ThemePrefs;
  setPrefs: (p: ThemePrefs) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const scheme: 'light' | 'dark' = systemScheme === 'dark' ? 'dark' : 'light';
  const [prefs, setPrefsState] = useState<ThemePrefs>({ machineSurface: 'umber' });

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (raw) setPrefsState(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  const setPrefs = (p: ThemePrefs) => {
    setPrefsState(p);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p)).catch(() => {});
  };

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      c: scheme === 'dark' ? darkColors : lightColors,
      machine: prefs.machineSurface === 'deepTeal' ? machineDeepTeal : machineUmber,
      accents,
      kindColors,
      oxblood,
      space,
      radius,
      type,
      motion,
      layout,
      contactShadow: scheme === 'light' ? contactShadow : '',
    }),
    [scheme, prefs.machineSurface],
  );

  return <ThemeContext.Provider value={{ theme, prefs, setPrefs }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx.theme;
}

export function useThemePrefs() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePrefs outside ThemeProvider');
  return { prefs: ctx.prefs, setPrefs: ctx.setPrefs };
}
