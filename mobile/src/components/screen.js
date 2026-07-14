import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, font } from '../theme';

// Standard page frame: a header with title/subtitle over the content.
export function ScreenShell({ title, subtitle, right, children }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={font.h1}>{title}</Text>
          {subtitle ? <Text style={font.muted}>{subtitle}</Text> : null}
        </View>
        {right}
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
export function useFocusLoad(loader, setRefreshing) {
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setRefreshing?.(true);
    try {
      await loader();
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing?.(false);
    }
  }, [loader, setRefreshing]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { reload, error };
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
