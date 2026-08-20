import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiRequest,
  clearAccessToken,
  setAccessToken
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/api/auth/refresh', { method: 'POST' }, false)
      .then((payload) => {
        setAccessToken(payload.data.accessToken);
        setUser(payload.data.user);
      })
      .catch(() => {
        clearAccessToken();
        setUser(null);
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

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout
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
