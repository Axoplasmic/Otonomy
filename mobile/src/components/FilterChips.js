import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { colors, spacing, font, radius } from '../theme';

// Horizontal, scrollable single-select chips (with a leading "All").
export function FilterChips({ options, value, onChange, allLabel = 'All' }) {
  const chips = [{ label: allLabel, value: null }, ...options.map((o) => ({ label: o, value: o }))];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.wrap}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((c) => {
        const active = c.value === value;
        return (
          <Pressable
            key={c.label}
            onPress={() => onChange(c.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { ...font.small, fontWeight: '600', color: colors.text },
  textActive: { color: '#fff' },
});
