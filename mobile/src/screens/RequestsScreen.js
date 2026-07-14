import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, Pressable, StyleSheet } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Card, Button, Badge, Row, EmptyState, Field } from '../components/ui';
import { ScreenShell, useFocusLoad } from '../components/screen';
import { formatDay, formatRange, formatDate } from '../format';
import { colors, spacing, font, radius } from '../theme';

const SWAP_TONE = { pending: 'warning', accepted: 'success', rejected: 'danger', cancelled: 'neutral' };
const TO_TONE = { pending: 'warning', approved: 'success', denied: 'danger' };

export function RequestsScreen() {
  const { user } = useAuth();
  const isManager = user.role === 'manager';
  const [tab, setTab] = useState('timeoff');
  const [swaps, setSwaps] = useState([]);
  const [timeoff, setTimeoff] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([api.listSwaps(), api.listTimeOff()]);
    setSwaps(s.swaps);
    setTimeoff(t.requests);
  }, []);

  const { reload } = useFocusLoad(load, setRefreshing);

  async function run(id, fn, errTitle) {
    setBusyId(id);
    try {
      await fn();
      await reload();
    } catch (e) {
      Alert.alert(errTitle, e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScreenShell title="Requests" subtitle={isManager ? 'Approvals & coverage' : 'Your swaps & time off'}>
      <Row style={styles.segment}>
        <Seg label="Time off" active={tab === 'timeoff'} onPress={() => setTab('timeoff')} />
        <Seg label="Swaps" active={tab === 'swaps'} onPress={() => setTab('swaps')} />
      </Row>

      {tab === 'timeoff' ? (
        <TimeOffList
          data={timeoff}
          isManager={isManager}
          refreshing={refreshing}
          onRefresh={reload}
          busyId={busyId}
          onDecide={(id, decision) =>
            run(id, () => api.decideTimeOff(id, decision), 'Could not update request')
          }
          onCreate={(payload) => run('new', () => api.createTimeOff(payload), 'Could not submit')}
        />
      ) : (
        <SwapList
          data={swaps}
          user={user}
          isManager={isManager}
          refreshing={refreshing}
          onRefresh={reload}
          busyId={busyId}
          onAccept={(id) => run(id, () => api.acceptSwap(id), 'Could not accept swap')}
          onReject={(id) => run(id, () => api.rejectSwap(id), 'Could not update swap')}
        />
      )}
    </ScreenShell>
  );
}

function TimeOffList({ data, isManager, refreshing, onRefresh, busyId, onDecide, onCreate }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');

  function submit() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      Alert.alert('Check dates', 'Use YYYY-MM-DD for both dates.');
      return;
    }
    onCreate({ startDate: start, endDate: end, reason: reason.trim() || undefined });
    setStart('');
    setEnd('');
    setReason('');
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        !isManager ? (
          <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
            <Text style={[font.h3, { marginBottom: spacing.sm }]}>Request time off</Text>
            <Row style={{ gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label="From" value={start} onChangeText={setStart} placeholder="2026-08-01" autoCapitalize="none" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="To" value={end} onChangeText={setEnd} placeholder="2026-08-03" autoCapitalize="none" />
              </View>
            </Row>
            <Field label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="Vacation" />
            <Button title="Submit request" onPress={submit} loading={busyId === 'new'} />
          </Card>
        ) : null
      }
      ListEmptyComponent={<EmptyState title="No time-off requests" />}
      renderItem={({ item }) => (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={font.h3}>{isManager ? item.user_name : 'Time off'}</Text>
            <Badge label={item.status} tone={TO_TONE[item.status]} />
          </Row>
          <Text style={[font.body, { marginTop: spacing.xs }]}>
            {formatDate(item.start_date)} → {formatDate(item.end_date)}
          </Text>
          {item.reason ? <Text style={[font.muted, { marginTop: spacing.xs }]}>{item.reason}</Text> : null}
          {isManager && item.status === 'pending' ? (
            <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Button title="Approve" loading={busyId === item.id} onPress={() => onDecide(item.id, 'approved')} style={{ flex: 1 }} />
              <Button title="Deny" variant="danger" loading={busyId === item.id} onPress={() => onDecide(item.id, 'denied')} style={{ flex: 1 }} />
            </Row>
          ) : null}
        </Card>
      )}
    />
  );
}

function SwapList({ data, user, isManager, refreshing, onRefresh, busyId, onAccept, onReject }) {
  return (
    <FlatList
      data={data}
      keyExtractor={(s) => String(s.id)}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <EmptyState title="No swap requests" subtitle="Offer a shift for swap from My Shifts." />
      }
      renderItem={({ item }) => {
        const mine = item.requested_by === user.id;
        const canAccept = !mine && item.status === 'pending';
        return (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={font.h3}>{item.title}</Text>
              <Badge label={item.status} tone={SWAP_TONE[item.status]} />
            </Row>
            <Text style={[font.body, { marginTop: spacing.xs }]}>
              {formatDay(item.start_time)} · {formatRange(item.start_time, item.end_time)}
            </Text>
            <Text style={[font.small, { marginTop: spacing.xs }]}>
              {mine ? 'Offered by you' : `Offered by ${item.requester_name}`}
              {item.target_name ? ` → ${item.target_name}` : ' → anyone'}
            </Text>
            {item.message ? <Text style={[font.muted, { marginTop: spacing.xs }]}>“{item.message}”</Text> : null}

            {item.status === 'pending' ? (
              <Row style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {canAccept ? (
                  <Button title="Pick up shift" loading={busyId === item.id} onPress={() => onAccept(item.id)} style={{ flex: 1 }} />
                ) : null}
                {mine ? (
                  <Button title="Cancel" variant="ghost" loading={busyId === item.id} onPress={() => onReject(item.id)} style={{ flex: 1 }} />
                ) : null}
                {isManager && !mine && !canAccept ? null : null}
              </Row>
            ) : null}
          </Card>
        );
      }}
    />
  );
}

function Seg({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.seg, active && styles.segActive]}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seg: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.primary },
  segText: { ...font.body, fontWeight: '600', color: colors.textMuted },
  segTextActive: { color: '#fff' },
});
