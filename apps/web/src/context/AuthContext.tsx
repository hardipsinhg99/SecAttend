import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';

type AuthContextValue = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<User>; logout: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const logout = useCallback(() => { localStorage.removeItem('secattend_token'); setUser(null); }, []);
  useEffect(() => {
    const token = localStorage.getItem('secattend_token');
    if (!token) { setLoading(false); return; }
    api<{ user: User }>('/auth/me').then((data) => setUser(data.user)).catch(logout).finally(() => setLoading(false));
  }, [logout]);
  useEffect(() => { window.addEventListener('secattend:unauthorized', logout); return () => window.removeEventListener('secattend:unauthorized', logout); }, [logout]);
  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('secattend_token', data.token); setUser(data.user); return data.user;
  }, []);
  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
