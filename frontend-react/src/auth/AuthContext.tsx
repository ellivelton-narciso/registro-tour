import { createContext, useContext, useMemo, type ReactNode } from 'react';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = sessionStorage.getItem('token');

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login: (newToken: string) => {
        sessionStorage.setItem('token', newToken);
        window.location.href = '/admin';
      },
      logout: () => {
        sessionStorage.removeItem('token');
        window.location.href = '/admin/login';
      },
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
