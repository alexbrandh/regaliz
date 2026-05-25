'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getStoredPassword, setStoredPassword, clearStoredPassword } from './api';

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const saved = getStoredPassword();
    if (!saved) {
      setIsBootstrapping(false);
      return;
    }
    api.verify(saved).then(res => {
      if (res.success) setIsAuthenticated(true);
      else clearStoredPassword();
      setIsBootstrapping(false);
    }).catch(() => {
      setIsBootstrapping(false);
    });
  }, []);

  const login = useCallback(async (password: string) => {
    const res = await api.verify(password);
    if (res.success) {
      setStoredPassword(password);
      setIsAuthenticated(true);
      return { ok: true };
    }
    return { ok: false, error: res.error || 'Contraseña incorrecta' };
  }, []);

  const logout = useCallback(() => {
    clearStoredPassword();
    setIsAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ isAuthenticated, isBootstrapping, login, logout }),
    [isAuthenticated, isBootstrapping, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
