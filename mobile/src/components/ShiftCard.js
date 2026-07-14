import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Badge, Row, Button } from './ui';
import { colors, spacing, font } from '../theme';
import { formatRange } from '../format';

// One shift, with coverage info and optional action button.
export function ShiftCard({ shift, action, currentUserId }) {
  const tone =
    shift.status === 'cancelled'
      ? 'danger'
      : shift.isOpen
      ? 'open'
      : 'success';
  const statusLabel =
    shift.status === 'cancelled'
      ? 'Cancelled'
      : shift.isOpen
      ? `${shift.openSlots} open`
      : 'Fully staffed';

  const mine = shift.assignees?.some((a) => a.user_id === currentUserId);

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Text style={font.h3}>{shift.title}</Text>
        <Badge label={statusLabel} tone={tone} />
      </Row>
      <Text style={styles.time}>{formatRange(shift.start_time, shift.end_time)}</Text>
      <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: spacing.xs }}>
        <Badge label={shift.department} tone="primary" />
        {shift.role_required ? <Badge label={shift.role_required} tone="neutral" /> : null}
        {shift.location ? <Text style={styles.loc}>{shift.location}</Text> : null}
      </Row>

      {shift.assignees?.length ? (
        <View style={styles.staff}>
          <Text style={font.small}>
            Staff: {shift.assignees.map((a) => a.name).join(', ')}
          </Text>
        </View>
      ) : (
        <Text style={[font.small, { marginTop: spacing.sm }]}>No one assigned yet</Text>
      )}

      {mine ? (
        <View style={{ marginTop: spacing.sm }}>
          <Badge label="You're on this shift" tone="success" />
        </View>
      ) : null}

      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  time: { ...font.body, fontWeight: '600', color: colors.primaryDark },
  loc: { ...font.small, alignSelf: 'center' },
  staff: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
