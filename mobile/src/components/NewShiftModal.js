import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { api } from '../api';
import { Button, Field, Row } from './ui';
import { colors, spacing, font, radius } from '../theme';

// Composes a naive ISO timestamp (local wall-clock) from date + hour parts.
function iso(date, hour) {
  const h = String(parseInt(hour, 10) || 0).padStart(2, '0');
  return `${date}T${h}:00:00`;
}

export function NewShiftModal({ visible, onClose, onCreated }) {
  const [title, setTitle] = useState('Day Shift');
  const [department, setDepartment] = useState('Emergency');
  const [roleRequired, setRoleRequired] = useState('RN');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState('7');
  const [endHour, setEndHour] = useState('19');
  const [requiredStaff, setRequiredStaff] = useState('1');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Enter a date as YYYY-MM-DD');
      return;
    }
    setSaving(true);
    try {
      const { shift } = await api.createShift({
        title: title.trim(),
        department: department.trim(),
        roleRequired: roleRequired.trim() || undefined,
        location: location.trim() || undefined,
        startTime: iso(date, startHour),
        endTime: iso(date, endHour),
        requiredStaff: parseInt(requiredStaff, 10) || 1,
      });
      onCreated?.(shift);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={font.h2}>New shift</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Title" value={title} onChangeText={setTitle} />
            <Field label="Department" value={department} onChangeText={setDepartment} />
            <Field label="Role required" value={roleRequired} onChangeText={setRoleRequired} placeholder="RN, LPN…" />
            <Field label="Location" value={location} onChangeText={setLocation} placeholder="ED Bay A" />
            <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-07-20" autoCapitalize="none" />
            <Row style={{ gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Field label="Start hour (0-23)" value={startHour} onChangeText={setStartHour} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="End hour (0-23)" value={endHour} onChangeText={setEndHour} keyboardType="number-pad" />
              </View>
            </Row>
            <Field label="Staff needed" value={requiredStaff} onChangeText={setRequiredStaff} keyboardType="number-pad" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Publish shift" onPress={save} loading={saving} />
            <View style={{ height: spacing.xl }} />
          </ScrollView>
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
    maxHeight: '90%',
  },
  close: { fontSize: 20, color: colors.textMuted, paddingHorizontal: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.md },
});
