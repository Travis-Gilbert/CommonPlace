import { Tabs } from 'expo-router';
import React from 'react';

import { TabBarWithFab } from '@/components/nav/TabBarWithFab';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBarWithFab {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="commonplaces" />
      <Tabs.Screen name="data" />
    </Tabs>
  );
}
