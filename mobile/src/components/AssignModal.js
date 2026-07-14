import React, { useState, useEffect } from 'react';
import { Modal, View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { api } from '../api';
import { Row, Badge, Button } from './ui';
import { colors, spacing, font, radius } from '../theme';
import { formatRange } from '../format';

// Lets a manager assign workers to a specific shift.
export function AssignModal({ shift, visible, onClose, onChanged }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api
      .listUsers('?role=worker')
      .then(({ users }) => setWorkers(users))
      .finally(() => setLoading(false));
  }, [visible]);

  if (!shift) return null;
  const assignedIds = new Set((shift.assignees || []).map((a) => a.user_id));

  async function toggle(worker) {
    setBusyId(worker.id);
    try {
      if (assignedIds.has(worker.id)) {
        const assignment = shift.assignees.find((a) => a.user_id === worker.id);
        await api.drop(assignment.assignment_id);
      } else {
        await api.assign(shift.id, worker.id);
      }
      await onChanged?.();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <Text style={font.h2}>Assign staff</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </Row>
          <Text style={font.muted}>
            {shift.title} · {formatRange(shift.start_time, shift.end_time)}
          </Text>
          <Text style={[font.small, { marginBottom: spacing.md }]}>
            {shift.filled}/{shift.required_staff} filled
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : (
            <FlatList
              data={workers}
              keyExtractor={(w) => String(w.id)}
              renderItem={({ item }) => {
                const assigned = assignedIds.has(item.id);
                return (
                  <Row style={styles.workerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={font.h3}>{item.name}</Text>
                      <Text style={font.small}>
                        {[item.job_title, item.department].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {assigned ? <Badge label="Assigned" tone="success" /> : null}
                    <Button
                      title={assigned ? 'Remove' : 'Assign'}
                      variant={assigned ? 'danger' : 'primary'}
                      loading={busyId === item.id}
                      onPress={() => toggle(item)}
                      style={{ marginLeft: spacing.sm, height: 40, paddingHorizontal: spacing.md }}
                    />
                  </Row>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  close: { fontSize: 20, color: colors.textMuted, paddingHorizontal: spacing.sm },
  workerRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
