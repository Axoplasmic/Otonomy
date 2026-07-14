import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationBell } from './Notifications';
import { colors, spacing, font } from '../theme';

// Standard page frame: a header with title/subtitle, a bell, and an optional
// action on the right.
export function ScreenShell({ title, subtitle, right, hideBell, children }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={font.h1}>{title}</Text>
          {subtitle ? <Text style={font.muted}>{subtitle}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {right}
          {hideBell ? null : <NotificationBell />}
        </View>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

export function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionText}>{title}</Text>
    </View>
  );
}

// Loads data on mount and exposes a reload that toggles the refreshing flag.
// `loading` is true only until the first load resolves (for initial spinners).
export function useFocusLoad(loader, setRefreshing) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setRefreshing?.(true);
    try {
      await loader();
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing?.(false);
      setLoading(false);
    }
  }, [loader, setRefreshing]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { reload, error, loading };
}

// Centered spinner for first-load states.
export function LoadingState() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionHeader: {
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionText: {
    ...font.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.primaryDark,
  },
});
