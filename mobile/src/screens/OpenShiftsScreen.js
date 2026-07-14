import React, { useState, useCallback, useMemo } from 'react';
import { SectionList, RefreshControl } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useFeedback } from '../components/Feedback';
import { ShiftCard } from '../components/ShiftCard';
import { ShiftDetailModal } from '../components/ShiftDetailModal';
import { FilterChips } from '../components/FilterChips';
import { Button, EmptyState } from '../components/ui';
import { ScreenShell, SectionHeader, useFocusLoad, LoadingState } from '../components/screen';
import { groupByDay } from '../format';
import { spacing } from '../theme';

export function OpenShiftsScreen() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const [shifts, setShifts] = useState([]);
  const [dept, setDept] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    const { shifts } = await api.listShifts('?open=true');
    setShifts(shifts);
  }, []);

  const { reload, loading } = useFocusLoad(load, setRefreshing);

  const departments = useMemo(() => [...new Set(shifts.map((s) => s.department))].sort(), [shifts]);
  const sections = useMemo(
    () => groupByDay(dept ? shifts.filter((s) => s.department === dept) : shifts),
    [shifts, dept]
  );

  async function claim(shift) {
    setBusyId(shift.id);
    try {
      await api.claim(shift.id);
      toast.success(`You picked up ${shift.title}`);
      await reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <ScreenShell title="Open Shifts" subtitle="Available to pick up">
        <LoadingState />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Open Shifts" subtitle="Available to pick up">
      {departments.length > 1 ? (
        <FilterChips options={departments} value={dept} onChange={setDept} />
      ) : null}
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
              onPress={() => setDetail(item)}
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
      <ShiftDetailModal
        shift={detail}
        visible={!!detail}
        currentUserId={user.id}
        onClose={() => setDetail(null)}
        onClaim={claim}
        busy={busyId === detail?.id}
      />
    </ScreenShell>
  );
}
