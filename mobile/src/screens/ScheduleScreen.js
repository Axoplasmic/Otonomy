import React, { useState, useCallback } from 'react';
import { SectionList, RefreshControl, View, Text } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ShiftCard } from '../components/ShiftCard';
import { Button, EmptyState, Badge, Row } from '../components/ui';
import { ScreenShell, SectionHeader, useFocusLoad } from '../components/screen';
import { NewShiftModal } from '../components/NewShiftModal';
import { AssignModal } from '../components/AssignModal';
import { groupByDay } from '../format';
import { spacing, colors } from '../theme';

export function ScheduleScreen() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [assignShift, setAssignShift] = useState(null);
  const [stats, setStats] = useState({ open: 0, total: 0 });

  const load = useCallback(async () => {
    const { shifts } = await api.listShifts();
    const active = shifts.filter((s) => s.status !== 'cancelled');
    setSections(groupByDay(active));
    setStats({ open: active.filter((s) => s.isOpen).length, total: active.length });
  }, []);

  const { reload } = useFocusLoad(load, setRefreshing);

  return (
    <ScreenShell
      title="Schedule"
      subtitle={`${stats.total} shifts · ${stats.open} with open slots`}
      right={<Button title="+ New" onPress={() => setShowNew(true)} style={{ height: 40, paddingHorizontal: spacing.md }} />}
    >
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

      <NewShiftModal visible={showNew} onClose={() => setShowNew(false)} onCreated={reload} />
      <AssignModal
        shift={assignShift}
        visible={!!assignShift}
        onClose={() => setAssignShift(null)}
        onChanged={async () => {
          await reload();
          // Refresh the shift being edited so the modal reflects new assignees.
          if (assignShift) {
            const { shift } = await api.getShift(assignShift.id);
            setAssignShift(shift);
          }
        }}
      />
    </ScreenShell>
  );
}
