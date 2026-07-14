import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { api } from '../api';
import { Button, Field, Row } from './ui';
import { Select, DateField, TimeField, Stepper, DEPARTMENTS, ROLES } from './pickers';
import { colors, spacing, font, radius } from '../theme';

// Composes a naive ISO timestamp. If the end time is at or before the start,
// the shift runs overnight, so the end lands on the next day.
function composeTimes(date, startTime, endTime) {
  const start = `${date}T${startTime}:00`;
  let endDate = date;
  if (endTime <= startTime) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + 1);
    endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return { startTime: start, endTime: `${endDate}T${endTime}:00` };
}

export function NewShiftModal({ visible, onClose, onCreated }) {
  const [title, setTitle] = useState('Day Shift');
  const [department, setDepartment] = useState('Emergency');
  const [roleRequired, setRoleRequired] = useState('RN');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [requiredStaff, setRequiredStaff] = useState(1);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (!date) {
      setError('Please pick a date');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    setSaving(true);
    try {
      const times = composeTimes(date, startTime, endTime);
      const { shift } = await api.createShift({
        title: title.trim(),
        department,
        roleRequired: roleRequired || undefined,
        location: location.trim() || undefined,
        startTime: times.startTime,
        endTime: times.endTime,
        requiredStaff,
      });
      onCreated?.(shift);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const overnight = endTime <= startTime;

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
            <Field label="Title" value={title} onChangeText={setTitle} placeholder="Day Shift" />
            <Select label="Department" value={department} options={DEPARTMENTS} onChange={setDepartment} />
            <Select label="Role required" value={roleRequired} options={ROLES} onChange={setRoleRequired} placeholder="Any role" />
            <Field label="Location" value={location} onChangeText={setLocation} placeholder="ED Bay A" />
            <DateField label="Date" value={date} onChange={setDate} />
            <Row style={{ gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <TimeField label="Start" value={startTime} onChange={setStartTime} />
              </View>
              <View style={{ flex: 1 }}>
                <TimeField label="End" value={endTime} onChange={setEndTime} />
              </View>
            </Row>
            {overnight ? <Text style={styles.hint}>Overnight shift — ends the next day.</Text> : null}
            <Stepper label="Staff needed" value={requiredStaff} onChange={setRequiredStaff} min={1} max={20} />
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
  hint: { ...font.small, color: colors.warning, marginTop: -spacing.sm, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md },
});
