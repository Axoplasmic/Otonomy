import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setToken } from './api';

const STORAGE_KEY = 'otonomy.session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore a persisted session on launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setToken(saved.token);
          setTokenState(saved.token);
          setUser(saved.user);
        }
      } catch {
        // ignore corrupt storage
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (t, u) => {
    setToken(t);
    setTokenState(t);
    setUser(u);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: u }));
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { token: t, user: u } = await api.login(email, password);
      await persist(t, u);
      return u;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const { token: t, user: u } = await api.register(payload);
      await persist(t, u);
      return u;
    },
    [persist]
  );

  const logout = useCallback(async () => {
    setToken(null);
    setTokenState(null);
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
