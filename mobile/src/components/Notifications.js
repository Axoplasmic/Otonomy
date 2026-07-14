import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api';
import { colors, spacing, font, radius } from '../theme';

const TYPE_META = {
  assigned: { icon: '📌', tone: colors.primary },
  claim: { icon: '✋', tone: colors.success },
  drop: { icon: '⚠️', tone: colors.danger },
  swap: { icon: '🔁', tone: colors.accent },
  timeoff: { icon: '🌴', tone: colors.warning },
};

function ago(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).replace(' ', 'T')}Z`);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (isNaN(secs)) return '';
  if (secs < 60) return 'just now';
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Header bell with an unread badge; opens the activity feed.
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const refreshCount = useCallback(() => {
    api.unreadCount().then((r) => setUnread(r.unread)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.bell} hitSlop={8}>
        <Text style={styles.bellIcon}>🔔</Text>
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
      <NotificationsModal
        visible={open}
        onClose={() => {
          setOpen(false);
          setUnread(0);
        }}
      />
    </>
  );
}

function NotificationsModal({ visible, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api
      .listNotifications()
      .then((r) => setItems(r.notifications))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    // Opening the feed marks everything read.
    api.markNotificationsRead().catch(() => {});
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={font.h2}>Notifications</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>You're all caught up.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 460 }}>
              {items.map((n) => {
                const meta = TYPE_META[n.type] || { icon: '•', tone: colors.textMuted };
                return (
                  <View key={n.id} style={[styles.row, !n.read && styles.rowUnread]}>
                    <View style={[styles.icon, { backgroundColor: meta.tone + '22' }]}>
                      <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{n.title}</Text>
                      {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
                      <Text style={styles.time}>{ago(n.created_at)}</Text>
                    </View>
                    {!n.read ? <View style={styles.dot} /> : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  close: { fontSize: 20, color: colors.textMuted, paddingHorizontal: spacing.sm },
  empty: { ...font.muted, textAlign: 'center', paddingVertical: spacing.xxl },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowUnread: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { ...font.body, fontWeight: '700' },
  body: { ...font.small, marginTop: 2 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
