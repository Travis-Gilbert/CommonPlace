import { Tabs } from 'expo-router';
import React from 'react';

import { FieldTabBar } from '@/components/nav/FieldTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FieldTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="capture" />
      <Tabs.Screen name="triage" />
    </Tabs>
  );
}
