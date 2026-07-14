import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Animated } from 'react-native';
import { colors, spacing, font, radius } from '../theme';

const FeedbackContext = createContext(null);

const TONE = {
  success: { bg: colors.successSoft, fg: colors.success, icon: '✓' },
  error: { bg: colors.dangerSoft, fg: colors.danger, icon: '!' },
  info: { bg: colors.primarySoft, fg: colors.primaryDark, icon: 'i' },
};

// Provides lightweight toasts and an in-app confirm dialog, replacing the
// blocking native Alert pop-ups (which look like ugly browser alerts on web).
export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const push = useCallback((type, message) => {
    const id = ++idRef.current;
    setToasts((list) => [...list, { id, type, message }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3500);
  }, []);

  const toast = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push]
  );

  // Returns a promise resolving true/false.
  const confirm = useCallback(
    (opts) => new Promise((resolve) => setDialog({ ...opts, resolve })),
    []
  );

  const closeDialog = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Toast stack */}
      <View pointerEvents="box-none" style={styles.toastWrap}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </View>

      {/* Confirm dialog */}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => closeDialog(false)}>
        <Pressable style={styles.backdrop} onPress={() => closeDialog(false)}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation?.()}>
            <Text style={font.h2}>{dialog?.title}</Text>
            {dialog?.message ? (
              <Text style={[font.body, { color: colors.textMuted, marginTop: spacing.sm }]}>{dialog.message}</Text>
            ) : null}
            <View style={styles.dialogActions}>
              <Pressable style={[styles.dBtn, styles.dCancel]} onPress={() => closeDialog(false)}>
                <Text style={styles.dCancelText}>{dialog?.cancelText || 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[styles.dBtn, { backgroundColor: dialog?.destructive ? colors.danger : colors.primary }]}
                onPress={() => closeDialog(true)}
              >
                <Text style={styles.dConfirmText}>{dialog?.confirmText || 'Confirm'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

function ToastItem({ toast }) {
  const anim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start();
  }, [anim]);
  const s = TONE[toast.type] || TONE.info;
  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: s.bg, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
      ]}
    >
      <View style={[styles.toastIcon, { backgroundColor: s.fg }]}>
        <Text style={styles.toastIconText}>{s.icon}</Text>
      </View>
      <Text style={[styles.toastText, { color: s.fg }]} numberOfLines={3}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    top: spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 420,
    width: '100%',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  toastIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toastIconText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  toastText: { flex: 1, fontWeight: '600', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: 380 },
  dialogActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  dBtn: { flex: 1, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dCancel: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  dCancelText: { ...font.body, fontWeight: '700', color: colors.text },
  dConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
