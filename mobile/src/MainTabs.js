import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from './AuthContext';
import { MyShiftsScreen } from './screens/MyShiftsScreen';
import { OpenShiftsScreen } from './screens/OpenShiftsScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { RequestsScreen } from './screens/RequestsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { colors, spacing, font } from './theme';

const WORKER_TABS = [
  { key: 'myshifts', label: 'My Shifts', icon: '📅', Screen: MyShiftsScreen },
  { key: 'open', label: 'Open', icon: '✋', Screen: OpenShiftsScreen },
  { key: 'requests', label: 'Requests', icon: '🔁', Screen: RequestsScreen },
  { key: 'profile', label: 'Profile', icon: '👤', Screen: ProfileScreen },
];

const MANAGER_TABS = [
  { key: 'home', label: 'Home', icon: '📊', Screen: DashboardScreen },
  { key: 'schedule', label: 'Schedule', icon: '🗓️', Screen: ScheduleScreen },
  { key: 'requests', label: 'Requests', icon: '✅', Screen: RequestsScreen },
  { key: 'profile', label: 'Profile', icon: '👤', Screen: ProfileScreen },
];

export function MainTabs() {
  const { user } = useAuth();
  const tabs = user.role === 'manager' ? MANAGER_TABS : WORKER_TABS;
  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((t) => t.key === active) || tabs[0];
  const Screen = current.Screen;

  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }}>
        <Screen />
      </View>
      <SafeAreaView style={styles.tabBarSafe} edges={['bottom']}>
        <View style={styles.tabBar}>
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <Pressable key={t.key} style={styles.tab} onPress={() => setActive(t.key)}>
                <Text style={[styles.icon, isActive && styles.iconActive]}>{t.icon}</Text>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabBarSafe: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  tabBar: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'web' ? spacing.sm : spacing.xs,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { fontSize: 20, opacity: 0.5 },
  iconActive: { opacity: 1 },
  tabLabel: { ...font.small, fontWeight: '600' },
  tabLabelActive: { color: colors.primary },
});
