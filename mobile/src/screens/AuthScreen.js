import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useAuth } from '../AuthContext';
import { Button, Field, Card, Row, Badge } from '../components/ui';
import { colors, spacing, font, radius } from '../theme';

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('worker');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register({
          email: email.trim(),
          password,
          name: name.trim(),
          role,
          jobTitle: jobTitle.trim() || undefined,
          department: department.trim() || undefined,
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail) {
    setEmail(demoEmail);
    setPassword('password123');
    setMode('login');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>O</Text>
          </View>
          <Text style={font.h1}>Otonomy</Text>
          <Text style={font.muted}>Healthcare shift scheduling</Text>
        </View>

        <Card>
          <Row style={styles.tabs}>
            <Tab label="Sign in" active={mode === 'login'} onPress={() => setMode('login')} />
            <Tab label="Register" active={mode === 'register'} onPress={() => setMode('register')} />
          </Row>

          {mode === 'register' && (
            <>
              <Field label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" />
              <Text style={styles.roleLabel}>I am a…</Text>
              <Row style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                <RolePick label="Worker" active={role === 'worker'} onPress={() => setRole('worker')} />
                <RolePick label="Manager" active={role === 'manager'} onPress={() => setRole('manager')} />
              </Row>
              <Field label="Job title" value={jobTitle} onChangeText={setJobTitle} placeholder="RN, LPN, CNA…" />
              <Field label="Department" value={department} onChangeText={setDepartment} placeholder="Emergency" />
            </>
          )}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@hospital.org"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={mode === 'login' ? 'Sign in' : 'Create account'}
            onPress={submit}
            loading={loading}
          />
        </Card>

        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Text style={[font.h3, { marginBottom: spacing.xs }]}>Try the demo</Text>
          <Text style={[font.small, { marginBottom: spacing.md }]}>
            Password for all demo accounts is “password123”.
          </Text>
          <Button title="Sign in as Manager (Dana)" variant="ghost" onPress={() => fillDemo('manager@otonomy.health')} style={{ marginBottom: spacing.sm }} />
          <Button title="Sign in as Worker (Alex, RN)" variant="ghost" onPress={() => fillDemo('alex@otonomy.health')} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tab({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RolePick({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.rolePick, active && styles.rolePickActive]}>
      <Text style={[styles.rolePickText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.md },
  brand: { alignItems: 'center', marginBottom: spacing.lg },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoText: { color: '#fff', fontSize: 34, fontWeight: '800' },
  tabs: { marginBottom: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabText: { ...font.body, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  roleLabel: { ...font.muted, marginBottom: spacing.xs, fontWeight: '600' },
  rolePick: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePickActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rolePickText: { ...font.body, fontWeight: '600', color: colors.text },
  error: { color: colors.danger, marginBottom: spacing.md, fontSize: 14 },
});
