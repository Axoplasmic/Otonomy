import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, font, radius } from '../theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKFULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Common values so managers/workers pick instead of typing free text.
export const DEPARTMENTS = ['Emergency', 'ICU', 'Med-Surg', 'Pediatrics', 'Surgery', 'Labor & Delivery', 'Oncology', 'Radiology'];
export const ROLES = ['RN', 'LPN', 'CNA', 'Nurse Practitioner', 'Physician', 'Tech', 'Respiratory Therapist'];

// --- helpers ---
function parseYmd(str) {
  return str && /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(`${str}T00:00:00`) : null;
}
function toYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function formatDateValue(str) {
  const d = parseYmd(str);
  return d ? `${WEEKFULL[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '';
}
export function formatTimeValue(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Bottom-sheet used by every picker.
function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHeader}>
            <Text style={font.h3}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FieldButton({ label, value, placeholder, onPress }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.control} onPress={onPress}>
        <Text style={[styles.controlText, !value && { color: colors.textMuted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={styles.chev}>▾</Text>
      </Pressable>
    </View>
  );
}

// A labeled dropdown backed by a list of options (strings or {label,value}).
export function Select({ label, value, options, onChange, placeholder = 'Select…' }) {
  const [open, setOpen] = useState(false);
  const opts = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o));
  const current = opts.find((o) => o.value === value);
  return (
    <>
      <FieldButton label={label} value={current?.label} placeholder={placeholder} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={label || 'Select'}>
        <ScrollView style={{ maxHeight: 380 }}>
          {opts.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={String(o.value)}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.label}</Text>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

// +/- stepper for small integer counts.
export function Stepper({ label, value, onChange, min = 1, max = 20 }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => set(value - 1)} disabled={value <= min}>
          <Text style={[styles.stepSign, value <= min && styles.stepDisabled]}>−</Text>
        </Pressable>
        <Text style={styles.stepVal}>{value}</Text>
        <Pressable style={styles.stepBtn} onPress={() => set(value + 1)} disabled={value >= max}>
          <Text style={[styles.stepSign, value >= max && styles.stepDisabled]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Calendar date picker. value/onChange use 'YYYY-MM-DD'.
export function DateField({ label, value, onChange, placeholder = 'Pick a date' }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(parseYmd(value) || new Date());

  const openSheet = () => {
    setCursor(parseYmd(value) || new Date());
    setOpen(true);
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toYmd(new Date());
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      <FieldButton label={label} value={formatDateValue(value)} placeholder={placeholder} onPress={openSheet} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={label || 'Select date'}>
        <View style={styles.calNav}>
          <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={10} style={styles.calNavBtn}>
            <Text style={styles.calArrow}>‹</Text>
          </Pressable>
          <Text style={font.h3}>{MONTHS[month]} {year}</Text>
          <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={10} style={styles.calNavBtn}>
            <Text style={styles.calArrow}>›</Text>
          </Pressable>
        </View>
        <View style={styles.calRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.calWeekday}>{w}</Text>
          ))}
        </View>
        <View style={styles.calGrid}>
          {cells.map((d, i) => {
            if (d === null) return <View key={`b${i}`} style={styles.calCell} />;
            const key = toYmd(new Date(year, month, d));
            const selected = key === value;
            const isToday = key === todayKey;
            return (
              <Pressable
                key={key}
                style={styles.calCell}
                onPress={() => {
                  onChange(key);
                  setOpen(false);
                }}
              >
                <View style={[styles.calDay, selected && styles.calDaySelected, !selected && isToday && styles.calDayToday]}>
                  <Text style={[styles.calDayText, selected && styles.calDayTextSelected]}>{d}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? 30 : 0;
  const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { value: v, label: formatTimeValue(v) };
});

// Time picker in 30-minute steps. value/onChange use 'HH:MM'.
export function TimeField({ label, value, onChange, placeholder = 'Pick a time' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FieldButton label={label} value={formatTimeValue(value)} placeholder={placeholder} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={label || 'Select time'}>
        <ScrollView style={{ maxHeight: 360 }}>
          {TIME_OPTIONS.map((o) => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.label}</Text>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...font.muted, marginBottom: spacing.xs, fontWeight: '600' },
  control: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlText: { fontSize: 15, color: colors.text, flex: 1 },
  chev: { color: colors.textMuted, fontSize: 14, marginLeft: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  close: { fontSize: 20, color: colors.textMuted, paddingHorizontal: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { fontSize: 15, color: colors.text },
  optionTextActive: { fontWeight: '700', color: colors.primaryDark },
  check: { color: colors.primary, fontWeight: '800' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  stepBtn: { width: 52, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontSize: 24, color: colors.primary, fontWeight: '700' },
  stepDisabled: { color: colors.border },
  stepVal: { minWidth: 44, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.text },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  calNavBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calArrow: { fontSize: 24, color: colors.primary, lineHeight: 26 },
  calRow: { flexDirection: 'row' },
  calWeekday: { flex: 1, textAlign: 'center', ...font.small, fontWeight: '700', marginBottom: spacing.xs },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calDay: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  calDaySelected: { backgroundColor: colors.primary },
  calDayToday: { borderWidth: 1, borderColor: colors.primary },
  calDayText: { fontSize: 15, color: colors.text },
  calDayTextSelected: { color: '#fff', fontWeight: '700' },
});
