import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../AuthContext';
import { Card, Button, Badge, Row } from '../components/ui';
import { ScreenShell } from '../components/screen';
import { CalendarSync } from '../components/CalendarSync';
import { GoogleSync } from '../components/GoogleSync';
import { BASE_URL } from '../api';
import { colors, spacing, font, radius } from '../theme';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  return (
    <ScreenShell title="Profile">
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <Row>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={font.h2}>{user.name}</Text>
              <Row style={{ gap: 6, marginTop: 4 }}>
                <Badge label={user.role === 'manager' ? 'Manager' : 'Worker'} tone="primary" />
                {user.job_title ? <Badge label={user.job_title} tone="neutral" /> : null}
              </Row>
            </View>
          </Row>
          <View style={styles.divider} />
          <Detail label="Email" value={user.email} />
          {user.department ? <Detail label="Department" value={user.department} /> : null}
          {user.phone ? <Detail label="Phone" value={user.phone} /> : null}
        </Card>

        {user.role === 'worker' ? <CalendarSync /> : null}
        {user.role === 'worker' ? <GoogleSync /> : null}

        <Card>
          <Text style={font.h3}>Connection</Text>
          <Detail label="API server" value={BASE_URL} />
          <Text style={[font.small, { marginTop: spacing.sm }]}>
            On a physical device, set EXPO_PUBLIC_API_URL to your computer's LAN address.
          </Text>
        </Card>

        <Button title="Sign out" variant="danger" onPress={logout} />
      </ScrollView>
    </ScreenShell>
  );
}

function Detail({ label, value }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
      <Text style={font.muted}>{label}</Text>
      <Text style={[font.body, { fontWeight: '600', flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});
