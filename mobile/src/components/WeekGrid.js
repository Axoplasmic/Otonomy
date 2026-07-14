import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  PanResponder,
  Animated,
} from 'react-native';
import { useFeedback } from './Feedback';
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
  offOnDay,
  DAY_LABELS,
} from '../format';

const COL_W = 138;
const CHIP_W = 130;

// Coverage → chip colors.
function coverageStyle(shift) {
  if (shift.status === 'cancelled') return { bg: colors.border, fg: colors.textMuted };
  if (shift.filled >= shift.required_staff) return { bg: colors.successSoft, fg: colors.success };
  if (shift.filled === 0) return { bg: colors.warningSoft, fg: colors.warning };
  return { bg: colors.openSoft, fg: colors.open };
}

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
}

// A manager week view: 7 day columns of shift chips, navigable week-by-week,
// with drag-to-assign from a worker tray and approved time-off shown as blocks.
export function WeekGrid({ shifts, workers = [], timeOff = [], onSelectShift, onAssign, onCopyWeek }) {
  const { toast, confirm } = useFeedback();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [pinned, setPinned] = useState(false);
  const [copying, setCopying] = useState(false);

  // Drag state
  const [dragging, setDragging] = useState(null); // worker being dragged
  const [hoverId, setHoverId] = useState(null); // shift id under the finger
  const pan = useRef(new Animated.ValueXY()).current;
  const containerRef = useRef(null);
  const originRef = useRef({ x: 0, y: 0 }); // grid container's window offset
  const cellRefs = useRef(new Map()); // shiftId -> View node
  const rectsRef = useRef([]); // cached cell rects captured at drag start

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

  const today = ymd(new Date());

  // --- Copy last week ---
  const doCopy = async () => {
    const from = ymd(addDays(weekStart, -7));
    const to = ymd(weekStart);
    const ok = await confirm({
      title: 'Copy last week',
      message: `Duplicate last week's shifts into ${weekRangeLabel(weekStart)} as fresh open shifts?`,
      confirmText: 'Copy',
    });
    if (!ok) return;
    setCopying(true);
    try {
      const created = await onCopyWeek?.(from, to);
      toast.success(`Added ${created ?? 0} shift${created === 1 ? '' : 's'} to this week`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCopying(false);
    }
  };

  // --- Drag handling ---
  const snapshotRects = () => {
    rectsRef.current = [];
    for (const [id, node] of cellRefs.current.entries()) {
      if (node && node.measureInWindow) {
        node.measureInWindow((px, py, w, h) => rectsRef.current.push({ id, px, py, w, h }));
      }
    }
  };
  const hitTest = (x, y) => {
    for (const r of rectsRef.current) {
      if (x >= r.px && x <= r.px + r.w && y >= r.py && y <= r.py + r.h) return r.id;
    }
    return null;
  };

  const measureOrigin = (cb) => {
    if (containerRef.current && containerRef.current.measureInWindow) {
      containerRef.current.measureInWindow((x, y) => {
        originRef.current = { x, y };
        cb && cb();
      });
    } else {
      cb && cb();
    }
  };
  const startDrag = (worker, x, y) => {
    setDragging(worker);
    measureOrigin(() => {
      snapshotRects();
      pan.setValue({ x: x - originRef.current.x, y: y - originRef.current.y });
    });
  };
  const moveDrag = (x, y) => {
    pan.setValue({ x: x - originRef.current.x, y: y - originRef.current.y });
    setHoverId(hitTest(x, y));
  };
  const endDrag = async (x, y) => {
    const worker = dragging;
    const targetId = x == null ? null : hitTest(x, y);
    setDragging(null);
    setHoverId(null);
    if (!worker || !targetId) return;

    const shift = shifts.find((s) => s.id === targetId);
    if (!shift) return;
    const dayKey = (shift.start_time || '').slice(0, 10);
    const off = offOnDay(timeOff, dayKey).some((r) => r.user_id === worker.id);
    if (off) {
      toast.error(`${worker.name} is on leave ${monthDay(shiftDate(shift.start_time))}`);
      return;
    }
    try {
      await onAssign?.(shift.id, worker.id);
      toast.success(`${worker.name.split(' ')[0]} assigned to ${shift.title}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const registerCell = (id) => (node) => {
    if (node) cellRefs.current.set(id, node);
    else cellRefs.current.delete(id);
  };

  return (
    <View ref={containerRef} style={{ flex: 1 }}>
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

      <Pressable onPress={doCopy} disabled={copying} style={styles.copyBtn}>
        <Text style={styles.copyText}>{copying ? 'Copying…' : '⧉  Copy last week into this week'}</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row' }}>
            {days.map((date) => {
              const key = ymd(date);
              const list = byDay.get(key) || [];
              const isToday = key === today;
              const offToday = offOnDay(timeOff, key);
              const openCount = list.reduce(
                (n, s) => n + (s.status !== 'cancelled' ? Math.max(0, s.required_staff - s.filled) : 0),
                0
              );
              return (
                <View key={key} style={styles.col}>
                  <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
                    <Text style={[styles.dayName, isToday && styles.todayText]}>{DAY_LABELS[date.getDay()]}</Text>
                    <Text style={[styles.dayNum, isToday && styles.todayText]}>{monthDay(date)}</Text>
                    <Text style={styles.dayMeta}>
                      {list.length ? `${list.length} shift${list.length > 1 ? 's' : ''}` : '—'}
                      {openCount ? ` · ${openCount} open` : ''}
                    </Text>
                  </View>

                  {offToday.length > 0 && (
                    <View style={styles.offBlock}>
                      <Text style={styles.offTitle}>🌴 Time off</Text>
                      {offToday.map((r) => (
                        <Text key={r.id} style={styles.offName} numberOfLines={1}>
                          {r.user_name}
                        </Text>
                      ))}
                    </View>
                  )}

                  {list.length === 0 && offToday.length === 0 ? (
                    <Text style={styles.emptyCol}>No shifts</Text>
                  ) : (
                    list.map((s) => {
                      const c = coverageStyle(s);
                      const isHover = hoverId === s.id;
                      return (
                        <Pressable
                          key={s.id}
                          ref={registerCell(s.id)}
                          onPress={() => onSelectShift?.(s)}
                          style={[
                            styles.chip,
                            { backgroundColor: c.bg },
                            isHover && styles.chipHover,
                          ]}
                        >
                          <Text style={[styles.chipTime, { color: c.fg }]} numberOfLines={1}>
                            {formatTimeShort(s.start_time)}–{formatTimeShort(s.end_time)}
                          </Text>
                          <Text style={styles.chipTitle} numberOfLines={1}>{s.title}</Text>
                          <View style={styles.chipFooter}>
                            <Text style={styles.chipDept} numberOfLines={1}>{s.department}</Text>
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

      {/* Worker tray */}
      <View style={styles.tray}>
        <Text style={styles.trayHint}>
          {dragging ? `Drop ${dragging.name} on a shift` : 'Drag a teammate onto a shift to assign'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
          {workers.map((w) => (
            <DraggableWorker key={w.id} worker={w} onStart={startDrag} onMove={moveDrag} onEnd={endDrag} />
          ))}
        </ScrollView>
      </View>

      {/* Floating drag avatar */}
      {dragging && (
        <Animated.View
          pointerEvents="none"
          style={[styles.floating, { transform: pan.getTranslateTransform() }]}
        >
          <View style={styles.floatAvatar}>
            <Text style={styles.floatInitials}>{initials(dragging.name)}</Text>
          </View>
          <Text style={styles.floatName} numberOfLines={1}>{dragging.name}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// A worker chip that can be dragged onto the grid. Vertical drag starts the
// drag; horizontal movement is left to the tray's ScrollView.
function DraggableWorker({ worker, onStart, onMove, onEnd }) {
  // Keep the latest callbacks in refs so the once-created PanResponder always
  // invokes current closures (with up-to-date drag state, shifts, etc.).
  const startRef = useRef(onStart);
  const moveRef = useRef(onMove);
  const endRef = useRef(onEnd);
  startRef.current = onStart;
  moveRef.current = onMove;
  endRef.current = onEnd;

  const responder = useRef(
    PanResponder.create({
      // Claim the gesture on press so the browser doesn't select text / scroll.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => startRef.current(worker, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e, g) => moveRef.current(g.moveX, g.moveY),
      onPanResponderRelease: (e, g) => endRef.current(g.moveX, g.moveY),
      onPanResponderTerminate: (e, g) => endRef.current(g?.moveX ?? null, g?.moveY ?? null),
    })
  ).current;

  return (
    <View {...responder.panHandlers} style={[styles.trayChip, { userSelect: 'none' }]}>
      <View style={styles.trayAvatar}>
        <Text style={styles.trayInitials}>{initials(worker.name)}</Text>
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.trayName} numberOfLines={1}>{worker.name.split(' ')[0]}</Text>
        <Text style={styles.trayRole} numberOfLines={1}>{worker.job_title || 'Staff'}</Text>
      </View>
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
  copyBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
  },
  copyText: { ...font.muted, color: colors.primaryDark, fontWeight: '700' },
  col: { width: COL_W, marginRight: spacing.sm },
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
  offBlock: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.danger,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  offTitle: { fontSize: 11, fontWeight: '800', color: colors.danger, marginBottom: 2 },
  offName: { fontSize: 12, color: colors.danger },
  chip: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  chipHover: { borderWidth: 2, borderColor: colors.primary, transform: [{ scale: 1.03 }] },
  chipTime: { fontSize: 13, fontWeight: '800' },
  chipTitle: { ...font.small, color: colors.text, fontWeight: '600', marginTop: 2 },
  chipFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  chipDept: { fontSize: 11, color: colors.textMuted, flex: 1 },
  chipCount: { fontSize: 11, fontWeight: '800' },
  tray: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
  },
  trayHint: { ...font.small, paddingHorizontal: spacing.md, marginBottom: spacing.sm, fontWeight: '600' },
  trayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.md,
  },
  trayAvatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayInitials: { color: '#fff', fontWeight: '800', fontSize: 13 },
  trayName: { ...font.small, color: colors.text, fontWeight: '700' },
  trayRole: { fontSize: 11, color: colors.textMuted },
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CHIP_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    opacity: 0.95,
    marginLeft: -CHIP_W / 2,
    marginTop: -22,
  },
  floatAvatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatInitials: { color: colors.primaryDark, fontWeight: '800', fontSize: 12 },
  floatName: { color: '#fff', fontWeight: '700', fontSize: 12, flexShrink: 1 },
});
