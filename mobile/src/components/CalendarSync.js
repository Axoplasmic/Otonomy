import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, TextInput, ActivityIndicator, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from '../api';
import { Card, Button, Row } from './ui';
import { feedUrl, webcalUrl, googleSubscribeUrl } from '../calendar';
import { colors, spacing, font, radius } from '../theme';

// Lets a worker subscribe their Google/Apple/Outlook calendar to their shifts.
export function CalendarSync() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getCalendarToken()
      .then(({ token }) => setToken(token))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const url = token ? feedUrl(token) : '';

  async function copy() {
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  const open = (u) => Linking.openURL(u).catch(() => {});

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Text style={font.h3}>📅 Sync to your calendar</Text>
      </Row>
      <Text style={[font.small, { marginBottom: spacing.md }]}>
        Subscribe once and your shifts appear in Google, Apple, or Outlook calendars —
        and stay up to date automatically when the schedule changes.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <Text style={{ color: colors.danger }}>{error}</Text>
      ) : (
        <>
          <Text style={styles.label}>Your private feed link</Text>
          <TextInput
            style={styles.urlBox}
            value={url}
            editable={false}
            selectTextOnFocus
            multiline
          />
          <Row style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title={copied ? 'Copied ✓' : 'Copy link'} variant="ghost" onPress={copy} style={{ flex: 1 }} />
            <Button title="Add to Google" onPress={() => open(googleSubscribeUrl(token))} style={{ flex: 1 }} />
          </Row>
          <Pressable onPress={() => open(webcalUrl(token))} style={{ marginTop: spacing.sm }}>
            <Text style={styles.linkText}>Add to Apple / Outlook (webcal) →</Text>
          </Pressable>

          <View style={styles.help}>
            <Text style={styles.helpTitle}>Add it manually in Google Calendar</Text>
            <Text style={styles.helpStep}>1. Open Google Calendar on the web</Text>
            <Text style={styles.helpStep}>2. Other calendars → + → “From URL”</Text>
            <Text style={styles.helpStep}>3. Paste the link above and click Add</Text>
            <Text style={[font.small, { marginTop: spacing.sm }]}>
              Note: your calendar app fetches this URL, so the Otonomy server must be reachable
              from the internet for auto-sync (works once deployed). On a local dev server, use the
              per-shift “Add to Google Calendar” buttons on My Shifts instead.
            </Text>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { ...font.muted, fontWeight: '600', marginBottom: spacing.xs },
  urlBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.bg,
    fontSize: 12,
    color: colors.text,
    ...(Platform.OS === 'web' ? { fontFamily: 'monospace' } : {}),
    minHeight: 54,
  },
  linkText: { ...font.body, color: colors.accent, fontWeight: '600' },
  help: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  helpTitle: { ...font.small, fontWeight: '700', marginBottom: spacing.xs },
  helpStep: { ...font.small, marginBottom: 2 },
});
