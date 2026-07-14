import React, { useState, useCallback } from 'react';
import { SectionList, RefreshControl, View, Text, Pressable, StyleSheet } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ShiftCard } from '../components/ShiftCard';
import { Button, EmptyState } from '../components/ui';
import { ScreenShell, SectionHeader, useFocusLoad } from '../components/screen';
import { NewShiftModal } from '../components/NewShiftModal';
import { AssignModal } from '../components/AssignModal';
import { WeekGrid } from '../components/WeekGrid';
import { groupByDay } from '../format';
import { spacing, colors, font, radius } from '../theme';

export function ScheduleScreen() {
  const { user } = useAuth();
  const [view, setView] = useState('week'); // 'week' | 'list'
  const [sections, setSections] = useState([]);
  const [active, setActive] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [assignShift, setAssignShift] = useState(null);
  const [stats, setStats] = useState({ open: 0, total: 0 });

  const load = useCallback(async () => {
    const { shifts } = await api.listShifts();
    const activeShifts = shifts.filter((s) => s.status !== 'cancelled');
    setActive(activeShifts);
    setSections(groupByDay(activeShifts));
    setStats({ open: activeShifts.filter((s) => s.isOpen).length, total: activeShifts.length });
  }, []);

  const { reload } = useFocusLoad(load, setRefreshing);

  // Reopen the assign modal with fresh data after an assignment changes.
  const onAssignChanged = async () => {
    await reload();
    if (assignShift) {
      const { shift } = await api.getShift(assignShift.id);
      setAssignShift(shift);
    }
  };

  return (
    <ScreenShell
      title="Schedule"
      subtitle={`${stats.total} shifts · ${stats.open} with open slots`}
      right={
        <Button
          title="+ New"
          onPress={() => setShowNew(true)}
          style={{ height: 40, paddingHorizontal: spacing.md }}
        />
      }
    >
      <View style={styles.toggle}>
        <Toggle label="Week" active={view === 'week'} onPress={() => setView('week')} />
        <Toggle label="List" active={view === 'list'} onPress={() => setView('list')} />
      </View>

      {view === 'week' ? (
        active.length === 0 ? (
          <EmptyState title="No shifts yet" subtitle="Tap “+ New” to publish your first shift." />
        ) : (
          <WeekGrid shifts={active} onSelectShift={setAssignShift} />
        )
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
          ListEmptyComponent={
            <EmptyState title="No shifts yet" subtitle="Tap “+ New” to publish your first shift." />
          }
          renderItem={({ item }) => (
            <ShiftCard
              shift={item}
              currentUserId={user.id}
              action={
                <Button
                  title={item.isOpen ? `Assign staff · ${item.openSlots} open` : 'Manage staff'}
                  variant="ghost"
                  onPress={() => setAssignShift(item)}
                />
              }
            />
          )}
        />
      )}

      <NewShiftModal visible={showNew} onClose={() => setShowNew(false)} onCreated={reload} />
      <AssignModal
        shift={assignShift}
        visible={!!assignShift}
        onClose={() => setAssignShift(null)}
        onChanged={onAssignChanged}
      />
    </ScreenShell>
  );
}

function Toggle({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggleBtn, active && styles.toggleBtnActive]}>
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { ...font.body, fontWeight: '600', color: colors.textMuted },
  toggleTextActive: { color: '#fff' },
});
