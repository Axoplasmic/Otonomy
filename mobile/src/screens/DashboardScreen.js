import React, { useState, useCallback, useMemo } from 'react';
import { ScrollView, View, Text, RefreshControl, Pressable, StyleSheet } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Card, Badge, Row } from '../components/ui';
import { ScreenShell, useFocusLoad, LoadingState } from '../components/screen';
import { AssignModal } from '../components/AssignModal';
import { formatDay, formatRange } from '../format';
import { colors, spacing, font, radius } from '../theme';

export function DashboardScreen() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [assignShift, setAssignShift] = useState(null);

  const load = useCallback(async () => {
    const [{ shifts }, { requests }, { swaps }] = await Promise.all([
      api.listShifts(),
      api.listTimeOff(),
      api.listSwaps(),
    ]);
    setShifts(shifts.filter((s) => s.status !== 'cancelled'));
    setTimeOff(requests);
    setSwaps(swaps);
  }, []);

  const { reload, loading } = useFocusLoad(load, setRefreshing);
  const approvedTimeOff = useMemo(() => timeOff.filter((r) => r.status === 'approved'), [timeOff]);

  const stats = useMemo(() => {
    const openSlots = shifts.reduce((n, s) => n + (s.openSlots || 0), 0);
    const understaffed = shifts.filter((s) => s.isOpen).sort((a, b) => a.start_time.localeCompare(b.start_time));
    const totalRequired = shifts.reduce((n, s) => n + s.required_staff, 0);
    const totalFilled = shifts.reduce((n, s) => n + s.filled, 0);
    const coverage = totalRequired ? Math.round((totalFilled / totalRequired) * 100) : 100;
    return {
      openSlots,
      understaffed,
      fullyStaffed: shifts.filter((s) => !s.isOpen).length,
      totalShifts: shifts.length,
      coverage,
      pendingTimeOff: timeOff.filter((r) => r.status === 'pending').length,
      pendingSwaps: swaps.filter((s) => s.status === 'pending').length,
    };
  }, [shifts, timeOff, swaps]);

  const onAssignChanged = async () => {
    await reload();
    if (assignShift) {
      const { shift } = await api.getShift(assignShift.id);
      setAssignShift(shift);
    }
  };

  if (loading) {
    return (
      <ScreenShell title="Dashboard" subtitle={user?.name}>
        <LoadingState />
      </ScreenShell>
    );
  }

  const pendingApprovals = stats.pendingTimeOff + stats.pendingSwaps;

  return (
    <ScreenShell title="Dashboard" subtitle={user?.name}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}
      >
        {/* KPI tiles */}
        <Row style={{ gap: spacing.md }}>
          <StatTile label="Open slots" value={stats.openSlots} tone={stats.openSlots > 0 ? 'warning' : 'success'} />
          <StatTile label="Fully staffed" value={stats.fullyStaffed} sub={`of ${stats.totalShifts} shifts`} tone="success" />
        </Row>
        <Row style={{ gap: spacing.md }}>
          <StatTile label="Pending approvals" value={pendingApprovals} tone={pendingApprovals > 0 ? 'primary' : 'neutral'} />
          <StatTile label="Scheduled shifts" value={stats.totalShifts} tone="neutral" />
        </Row>

        {/* Coverage meter */}
        <Card>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={font.h3}>Overall coverage</Text>
            <Text style={[font.h3, { color: coverageColor(stats.coverage) }]}>{stats.coverage}%</Text>
          </Row>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${stats.coverage}%`, backgroundColor: coverageColor(stats.coverage) }]} />
          </View>
          <Text style={[font.small, { marginTop: spacing.xs }]}>
            {stats.openSlots > 0 ? `${stats.openSlots} slot${stats.openSlots > 1 ? 's' : ''} still need staff` : 'Every shift is fully staffed 🎉'}
          </Text>
        </Card>

        {/* Understaffed alerts */}
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={font.h3}>⚠️ Needs attention</Text>
          {stats.understaffed.length ? <Badge label={`${stats.understaffed.length}`} tone="warning" /> : null}
        </Row>
        {stats.understaffed.length === 0 ? (
          <Card>
            <Text style={font.body}>Nothing needs attention — coverage is complete.</Text>
          </Card>
        ) : (
          stats.understaffed.slice(0, 8).map((s) => (
            <Card key={s.id} onPress={() => setAssignShift(s)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={font.h3}>{s.title}</Text>
                <Badge label={s.filled === 0 ? 'Needs staff' : `${s.openSlots} open`} tone={s.filled === 0 ? 'danger' : 'warning'} />
              </Row>
              <Text style={[font.body, { color: colors.primaryDark, fontWeight: '600', marginTop: 2 }]}>
                {formatDay(s.start_time)} · {formatRange(s.start_time, s.end_time)}
              </Text>
              <Row style={{ gap: 6, marginTop: spacing.xs }}>
                <Badge label={s.department} tone="primary" />
                <Text style={[font.small, { alignSelf: 'center' }]}>{s.filled}/{s.required_staff} staffed · tap to assign</Text>
              </Row>
            </Card>
          ))
        )}
      </ScrollView>

      <AssignModal
        shift={assignShift}
        timeOff={approvedTimeOff}
        visible={!!assignShift}
        onClose={() => setAssignShift(null)}
        onChanged={onAssignChanged}
      />
    </ScreenShell>
  );
}

function coverageColor(pct) {
  if (pct >= 100) return colors.success;
  if (pct >= 80) return colors.warning;
  return colors.danger;
}

const TILE_TONE = {
  warning: { fg: colors.warning, bg: colors.warningSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  primary: { fg: colors.primaryDark, bg: colors.primarySoft },
  neutral: { fg: colors.text, bg: colors.surface },
};

function StatTile({ label, value, sub, tone = 'neutral' }) {
  const t = TILE_TONE[tone] || TILE_TONE.neutral;
  return (
    <View style={[styles.tile, { backgroundColor: t.bg }]}>
      <Text style={[styles.tileValue, { color: t.fg }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  tileValue: { fontSize: 30, fontWeight: '800' },
  tileLabel: { ...font.body, fontWeight: '600', marginTop: 2 },
  tileSub: { ...font.small, marginTop: 2 },
  barTrack: { height: 12, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 12, borderRadius: 6 },
});
