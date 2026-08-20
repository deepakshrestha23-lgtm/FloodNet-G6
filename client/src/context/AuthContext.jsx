import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiRequest,
  clearAccessToken,
  refreshSession,
  setAccessToken
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Uses the shared single-flight refresh so React's development double-mount
    // and any concurrent request cannot race each other into a false logout.
    refreshSession()
      .then((session) => {
        if (session) {
          setUser(session.user);
        } else {
          clearAccessToken();
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const payload = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: credentials
    }, false);
    setAccessToken(payload.data.accessToken);
    setUser(payload.data.user);
    return payload.data.user;
  }

  async function register(details) {
    const payload = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: details
    }, false);
    return payload.data.user;
  }

  async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' }, false);
    clearAccessToken();
    setUser(null);
  }

  /** Re-reads the signed-in account so profile edits appear across the app. */
  async function refreshUser() {
    const payload = await apiRequest('/api/auth/me');
    setUser(payload.data.user);
    return payload.data.user;
  }

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refreshUser
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
