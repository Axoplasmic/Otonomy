import React from 'react';
import { View, ActivityIndicator, StatusBar, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/AuthContext';
import { FeedbackProvider } from './src/components/Feedback';
import { AuthScreen } from './src/screens/AuthScreen';
import { MainTabs } from './src/MainTabs';
import { colors } from './src/theme';

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return user ? <MainTabs /> : <AuthScreen />;
}

// On wide screens (desktop web), present the app inside a phone frame on a
// branded backdrop instead of a lone column stretched across the page.
function DeviceFrame({ children }) {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 700;

  if (!isWide) return <View style={{ flex: 1 }}>{children}</View>;

  const phoneHeight = Math.min(height - 48, 900);
  return (
    <View style={styles.backdrop}>
      <View style={[styles.phone, { height: phoneHeight }]}>{children}</View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FeedbackProvider>
          <StatusBar barStyle="dark-content" />
          <DeviceFrame>
            <Gate />
          </DeviceFrame>
        </FeedbackProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: 400,
    maxWidth: '100%',
    backgroundColor: colors.bg,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 10,
    borderColor: '#0B3B37',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
  },
});
