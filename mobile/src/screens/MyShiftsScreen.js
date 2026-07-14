import React, { useState, useCallback } from 'react';
import { SectionList, View, Text, RefreshControl, Alert } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { ShiftCard } from '../components/ShiftCard';
import { Button, EmptyState } from '../components/ui';
import { ScreenShell, SectionHeader, useFocusLoad } from '../components/screen';
import { groupByDay } from '../format';
import { spacing } from '../theme';

export function MyShiftsScreen() {
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { shifts } = await api.listShifts('?mine=true');
    setSections(groupByDay(shifts.filter((s) => s.status !== 'cancelled')));
  }, []);

  const { reload } = useFocusLoad(load, setRefreshing);

  async function drop(shift) {
    const assignment = shift.assignees.find((a) => a.user_id === user.id);
    if (!assignment) return;
    setBusyId(shift.id);
    try {
      await api.drop(assignment.assignment_id);
      await reload();
    } catch (e) {
      Alert.alert('Could not drop shift', e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function offerSwap(shift) {
    const assignment = shift.assignees.find((a) => a.user_id === user.id);
    if (!assignment) return;
    setBusyId(shift.id);
    try {
      await api.createSwap({ assignmentId: assignment.assignment_id, message: 'Open to swap' });
      Alert.alert('Swap offered', 'Coworkers can now pick up this shift.');
    } catch (e) {
      Alert.alert('Could not offer swap', e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScreenShell title="My Shifts" subtitle={user?.name}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
        renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
        ListEmptyComponent={
          <EmptyState
            title="No upcoming shifts"
            subtitle="Head to Open Shifts to pick up available work."
          />
        }
        renderItem={({ item }) => (
          <ShiftCard
            shift={item}
            currentUserId={user.id}
            action={
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title="Offer swap"
                  variant="ghost"
                  loading={busyId === item.id}
                  onPress={() => offerSwap(item)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Drop"
                  variant="danger"
                  loading={busyId === item.id}
                  onPress={() => drop(item)}
                  style={{ flex: 1 }}
                />
              </View>
            }
          />
        )}
      />
    </ScreenShell>
  );
}
