import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Linking, ActivityIndicator, Alert } from 'react-native';
import { api } from '../api';
import { Card, Button, Badge, Row } from './ui';
import { colors, spacing, font } from '../theme';

// Two-way Google Calendar sync via OAuth. Renders one of three states:
// not-configured, disconnected (connect), or connected (sync / disconnect).
export function GoogleSync() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.googleStatus());
    } catch {
      setStatus({ configured: false, connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connect() {
    setBusy(true);
    try {
      const { url } = await api.googleConnectUrl();
      await Linking.openURL(url);
      Alert.alert(
        'Finish in your browser',
        'Authorize Otonomy in the browser tab that opened, then come back and tap “Refresh”.'
      );
    } catch (e) {
      Alert.alert('Could not start Google sign-in', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    try {
      const { summary } = await api.googleSync();
      Alert.alert(
        'Synced to Google Calendar',
        `${summary.created} added · ${summary.updated} updated · ${summary.deleted} removed`
      );
      await refresh();
    } catch (e) {
      Alert.alert('Sync failed', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api.googleDisconnect();
      await refresh();
    } catch (e) {
      Alert.alert('Could not disconnect', e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Text style={font.h3}>🔄 Google Calendar (2-way)</Text>
        {status?.connected ? <Badge label="Connected" tone="success" /> : null}
      </Row>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : !status?.configured ? (
        <Text style={font.small}>
          Two-way Google sync isn’t enabled on this server. An admin can turn it on by adding Google
          OAuth credentials (see the backend README). Meanwhile, the calendar feed above works for
          everyone.
        </Text>
      ) : status.connected ? (
        <>
          <Text style={[font.small, { marginBottom: spacing.sm }]}>
            Connected as <Text style={{ fontWeight: '700', color: colors.text }}>{status.email}</Text>.
            {' '}Shifts push to Google automatically when your schedule changes
            {status.syncedEvents ? ` (${status.syncedEvents} synced).` : '.'}
          </Text>
          <Row style={{ gap: spacing.sm }}>
            <Button title="Sync now" onPress={syncNow} loading={busy} style={{ flex: 1 }} />
            <Button title="Disconnect" variant="danger" onPress={disconnect} loading={busy} style={{ flex: 1 }} />
          </Row>
        </>
      ) : (
        <>
          <Text style={[font.small, { marginBottom: spacing.md }]}>
            Connect your Google account and Otonomy will create and update real events in your
            calendar — instantly, no subscription URL needed.
          </Text>
          <Button title="Connect Google Calendar" onPress={connect} loading={busy} />
          <Button title="Refresh" variant="ghost" onPress={refresh} style={{ marginTop: spacing.sm }} />
        </>
      )}
    </Card>
  );
}
