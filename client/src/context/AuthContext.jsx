import { createContext, useContext, useEffect, useState, useCallback, startTransition } from 'react';
import { api, getToken, setToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  // The API client fires this when the server rejects the stored token.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = async (email, password) => {
    const { user, token } = await api.post('/auth/login', { email, password });
    setToken(token);
    setUser(user);
    return user;
  };

  const register = async (payload) => {
    const { user, token } = await api.post('/auth/register', payload);
    setToken(token);
    setUser(user);
    return user;
  };

  // React Router applies navigations inside a transition, so clearing the user in
  // an urgent update would render the protected page with no user (-> /login)
  // before the pending navigation to '/' lands. Clearing it in a transition too
  // makes both commit together.
  const clearUser = () => startTransition(() => setUser(null));

  const logout = () => {
    setToken(null);
    clearUser();
  };

  const refreshUser = async () => {
    const { user } = await api.get('/auth/me');
    setUser(user);
  };

  // PUT /api/users/me - name, phone, area
  const updateProfile = async (payload) => {
    const { user } = await api.put('/users/me', payload);
    setUser(user);
    return user;
  };

  // DELETE /api/users/me - soft delete; the API refuses while bookings are open
  // `onDeleted` runs before the user state is cleared, so the caller can navigate
  // away from the protected page first (otherwise ProtectedRoute wins the race
  // and bounces the visitor to /login instead of the home page).
  const deleteAccount = async (onDeleted) => {
    await api.del('/users/me');
    setToken(null);
    if (onDeleted) onDeleted();
    clearUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, updateProfile, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
