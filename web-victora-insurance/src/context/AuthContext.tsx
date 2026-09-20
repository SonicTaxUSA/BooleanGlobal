import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, type AuthUser, type ClientProfile } from "@/lib/api";

/**
 * Session-backed auth for both the client portal and the staff console.
 * The server owns identity and permissions — the UI only reflects the
 * role returned by /auth/me.
 */
type AuthState = {
  user: AuthUser | null;
  profile: ClientProfile | null;
  isLoading: boolean;
  isStaff: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  registerClient: (body: { name: string; email: string; password: string; phone?: string; source?: string; campaign?: string }) => Promise<void>;
  registerStaff: (body: { name: string; email: string; password: string; code: string; role?: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await api.me();
      setUser(res.user);
      setProfile(res.profile ?? null);
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const res = await api.login({ email, password });
      setUser(res.user);
      await refresh();
    },
    [refresh],
  );

  const registerClient = useCallback(
    async (body: { name: string; email: string; password: string; phone?: string; source?: string; campaign?: string }): Promise<void> => {
      await api.register(body);
      await refresh();
    },
    [refresh],
  );

  const registerStaff = useCallback(
    async (body: { name: string; email: string; password: string; code: string; role?: string }): Promise<void> => {
      await api.registerStaff(body);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setProfile(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      isLoading,
      isStaff: user !== null && user.role !== "client",
      refresh,
      login,
      registerClient,
      registerStaff,
      logout,
    }),
    [user, profile, isLoading, refresh, login, registerClient, registerStaff, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
