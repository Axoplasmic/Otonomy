import React, { useState, useCallback } from 'react';
import { SectionList, RefreshControl, Alert } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ShiftCard } from '../components/ShiftCard';
import { Button, EmptyState } from '../components/ui';
import { ScreenShell, SectionHeader, useFocusLoad } from '../components/screen';
import { groupByDay } from '../format';
import { spacing } from '../theme';

export function OpenShiftsScreen() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { shifts } = await api.listShifts('?open=true');
    setSections(groupByDay(shifts));
  }, []);

  const { reload } = useFocusLoad(load, setRefreshing);

  async function claim(shift) {
    setBusyId(shift.id);
    try {
      await api.claim(shift.id);
      Alert.alert('Shift claimed', `You picked up ${shift.title}.`);
      await reload();
    } catch (e) {
      Alert.alert('Could not claim shift', e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScreenShell title="Open Shifts" subtitle="Available to pick up">
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        ListEmptyComponent={
          <EmptyState title="No open shifts right now" subtitle="Pull to refresh to check again." />
        }
        renderItem={({ item }) => {
          const alreadyOn = item.assignees?.some((a) => a.user_id === user.id);
          return (
            <ShiftCard
              shift={item}
              currentUserId={user.id}
              action={
                alreadyOn ? null : (
                  <Button
                    title="Claim this shift"
                    loading={busyId === item.id}
                    onPress={() => claim(item)}
                  />
                )
              }
            />
          );
        }}
      />
    </ScreenShell>
  );
}
