import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, font, radius } from '../theme';
import {
  startOfWeek,
  weekDates,
  weekRangeLabel,
  addDays,
  ymd,
  monthDay,
  formatTimeShort,
  shiftDate,
  DAY_LABELS,
} from '../format';

const COL_W = 138;

// Coverage → chip colors.
function coverageStyle(shift) {
  if (shift.status === 'cancelled') return { bg: colors.border, fg: colors.textMuted };
  if (shift.filled >= shift.required_staff) return { bg: colors.successSoft, fg: colors.success };
  if (shift.filled === 0) return { bg: colors.warningSoft, fg: colors.warning };
  return { bg: colors.openSoft, fg: colors.open };
}

// A manager week view: 7 day columns of shift chips, navigable week-by-week.
export function WeekGrid({ shifts, onSelectShift, todayKey }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [pinned, setPinned] = useState(false);

  // Until the manager navigates, snap to the week of the earliest shift so
  // there's always data on screen regardless of the real-world date.
  useEffect(() => {
    if (pinned || !shifts.length) return;
    let earliest = null;
    for (const s of shifts) {
      const d = shiftDate(s.start_time);
      if (d && (!earliest || d < earliest)) earliest = d;
    }
    if (earliest) setWeekStart(startOfWeek(earliest));
  }, [shifts, pinned]);

  const days = useMemo(() => weekDates(weekStart), [weekStart]);

  // Bucket shifts by day key for this week.
  const byDay = useMemo(() => {
    const map = new Map(days.map((d) => [ymd(d), []]));
    for (const s of shifts) {
      const key = (s.start_time || '').slice(0, 10);
      if (map.has(key)) map.get(key).push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    }
    return map;
  }, [shifts, days]);

  const nav = (delta) => {
    setPinned(true);
    setWeekStart((w) => addDays(w, delta * 7));
  };
  const goThisWeek = () => {
    setPinned(true);
    setWeekStart(startOfWeek(new Date()));
  };

  const today = todayKey || ymd(new Date());

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.navBar}>
        <Pressable onPress={() => nav(-1)} hitSlop={10} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Pressable onPress={goThisWeek}>
          <Text style={styles.navLabel}>{weekRangeLabel(weekStart)}</Text>
          <Text style={styles.navSub}>Tap for current week</Text>
        </Pressable>
        <Pressable onPress={() => nav(1)} hitSlop={10} style={styles.navBtn}>
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row' }}>
            {days.map((date) => {
              const key = ymd(date);
              const list = byDay.get(key) || [];
              const isToday = key === today;
              const openCount = list.reduce(
                (n, s) => n + (s.status !== 'cancelled' ? Math.max(0, s.required_staff - s.filled) : 0),
                0
              );
              return (
                <View key={key} style={[styles.col, isToday && styles.colToday]}>
                  <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
                    <Text style={[styles.dayName, isToday && styles.todayText]}>
                      {DAY_LABELS[date.getDay()]}
                    </Text>
                    <Text style={[styles.dayNum, isToday && styles.todayText]}>{monthDay(date)}</Text>
                    <Text style={styles.dayMeta}>
                      {list.length ? `${list.length} shift${list.length > 1 ? 's' : ''}` : '—'}
                      {openCount ? ` · ${openCount} open` : ''}
                    </Text>
                  </View>

                  {list.length === 0 ? (
                    <Text style={styles.emptyCol}>No shifts</Text>
                  ) : (
                    list.map((s) => {
                      const c = coverageStyle(s);
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => onSelectShift?.(s)}
                          style={[styles.chip, { backgroundColor: c.bg }]}
                        >
                          <Text style={[styles.chipTime, { color: c.fg }]} numberOfLines={1}>
                            {formatTimeShort(s.start_time)}–{formatTimeShort(s.end_time)}
                          </Text>
                          <Text style={styles.chipTitle} numberOfLines={1}>
                            {s.title}
                          </Text>
                          <View style={styles.chipFooter}>
                            <Text style={styles.chipDept} numberOfLines={1}>
                              {s.department}
                            </Text>
                            <Text style={[styles.chipCount, { color: c.fg }]}>
                              {s.filled}/{s.required_staff}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: { fontSize: 24, color: colors.primary, lineHeight: 26 },
  navLabel: { ...font.h3, textAlign: 'center' },
  navSub: { ...font.small, textAlign: 'center' },
  col: {
    width: COL_W,
    marginRight: spacing.sm,
  },
  colToday: {},
  dayHeader: {
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  dayHeaderToday: { borderBottomColor: colors.primary },
  dayName: { ...font.small, fontWeight: '700', textTransform: 'uppercase' },
  dayNum: { ...font.h3 },
  dayMeta: { ...font.small, marginTop: 2 },
  todayText: { color: colors.primary },
  emptyCol: { ...font.small, fontStyle: 'italic', paddingVertical: spacing.sm },
  chip: {
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipTime: { fontSize: 13, fontWeight: '800' },
  chipTitle: { ...font.small, color: colors.text, fontWeight: '600', marginTop: 2 },
  chipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  chipDept: { fontSize: 11, color: colors.textMuted, flex: 1 },
  chipCount: { fontSize: 11, fontWeight: '800' },
});
