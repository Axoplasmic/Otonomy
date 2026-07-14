import React from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { Button, Badge, Row } from './ui';
import { googleEventUrl } from '../calendar';
import { formatDay, formatRange, formatDate } from '../format';
import { colors, spacing, font, radius } from '../theme';

// Full details for a shift with role-appropriate actions. Workers can claim an
// open shift, or drop / offer-swap a shift they're on.
export function ShiftDetailModal({ shift, visible, currentUserId, onClose, onClaim, onDrop, onOfferSwap, busy }) {
  if (!shift) return null;
  const mine = shift.assignees?.some((a) => a.user_id === currentUserId);
  const coveragePct = Math.min(100, Math.round((shift.filled / shift.required_staff) * 100));
  const tone = shift.status === 'cancelled' ? 'danger' : shift.isOpen ? 'open' : 'success';
  const statusLabel =
    shift.status === 'cancelled' ? 'Cancelled' : shift.isOpen ? `${shift.openSlots} open` : 'Fully staffed';

  const act = (fn) => async () => {
    await fn?.(shift);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <Text style={font.h2}>{shift.title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </Row>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Badge label={statusLabel} tone={tone} />

            <View style={styles.block}>
              <Text style={styles.when}>{formatDay(shift.start_time)}</Text>
              <Text style={styles.time}>{formatRange(shift.start_time, shift.end_time)}</Text>
            </View>

            <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: spacing.md }}>
              <Badge label={shift.department} tone="primary" />
              {shift.role_required ? <Badge label={shift.role_required} tone="neutral" /> : null}
              {shift.location ? <Badge label={shift.location} tone="neutral" /> : null}
            </Row>

            {/* Coverage bar */}
            <Text style={styles.label}>Coverage</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${coveragePct}%`, backgroundColor: shift.isOpen ? colors.open : colors.success }]} />
            </View>
            <Text style={styles.coverage}>{shift.filled} of {shift.required_staff} staffed</Text>

            {/* Assignees */}
            <Text style={[styles.label, { marginTop: spacing.md }]}>Staff on this shift</Text>
            {shift.assignees?.length ? (
              shift.assignees.map((a) => (
                <Row key={a.assignment_id} style={styles.person}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{a.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={font.body}>{a.name}{a.user_id === currentUserId ? ' (you)' : ''}</Text>
                    {a.job_title ? <Text style={font.small}>{a.job_title}</Text> : null}
                  </View>
                </Row>
              ))
            ) : (
              <Text style={font.small}>No one assigned yet</Text>
            )}

            {shift.notes ? (
              <>
                <Text style={[styles.label, { marginTop: spacing.md }]}>Notes</Text>
                <Text style={font.body}>{shift.notes}</Text>
              </>
            ) : null}

            {/* Actions */}
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              {mine ? (
                <>
                  <Row style={{ gap: spacing.sm }}>
                    {onOfferSwap ? (
                      <Button title="Offer swap" variant="ghost" loading={busy} onPress={act(onOfferSwap)} style={{ flex: 1 }} />
                    ) : null}
                    {onDrop ? (
                      <Button title="Drop" variant="danger" loading={busy} onPress={act(onDrop)} style={{ flex: 1 }} />
                    ) : null}
                  </Row>
                  {shift.status !== 'cancelled' ? (
                    <Pressable onPress={() => Linking.openURL(googleEventUrl(shift)).catch(() => {})} style={styles.calLink}>
                      <Text style={styles.calLinkText}>📅  Add to Google Calendar</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : shift.isOpen && onClaim ? (
                <Button title="Claim this shift" loading={busy} onPress={act(onClaim)} />
              ) : null}
            </View>
            <View style={{ height: spacing.xl }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  close: { fontSize: 20, color: colors.textMuted, paddingHorizontal: spacing.sm },
  block: { marginVertical: spacing.md },
  when: { ...font.h3 },
  time: { ...font.body, fontWeight: '600', color: colors.primaryDark, marginTop: 2 },
  label: { ...font.muted, fontWeight: '700', marginBottom: spacing.xs },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  coverage: { ...font.small, marginTop: spacing.xs },
  person: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  calLink: { alignItems: 'center', paddingVertical: spacing.sm },
  calLinkText: { ...font.small, color: colors.accent, fontWeight: '600' },
});
