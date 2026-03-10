import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import bcrypt from 'bcryptjs';
import { ensureUserHasBasicUnlocks } from '@/lib/autoUnlock';
import { getUserByEmail } from '@/lib/lambdaDataClient';
import { clearStoredSession, getStoredSession, setStoredSession, type SessionUser } from '@/lib/clientSession';

type AuthContextValue = {
  user: SessionUser | null;
  loginPatient: (email: string) => Promise<SessionUser>;
  loginAdmin: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => getStoredSession());

  useEffect(() => {
    setUser(getStoredSession());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async loginPatient(email: string) {
        const data = await getUserByEmail(email.toLowerCase());
        if (!data) {
          throw new Error('Email not found');
        }

        await ensureUserHasBasicUnlocks(data.id);

        const nextUser: SessionUser = {
          id: data.id,
          email: data.email,
          ts: Date.now(),
        };
        setStoredSession(nextUser);
        setUser(nextUser);
        return nextUser;
      },
      async loginAdmin(email: string, password: string) {
        const data = await getUserByEmail(email.toLowerCase());
        const passwordHash = (data as { password_hash?: string } | null)?.password_hash;

        if (!data || !data.is_admin || !passwordHash) {
          throw new Error('Unauthorized');
        }

        const ok = await bcrypt.compare(password, passwordHash);
        if (!ok) {
          throw new Error('Unauthorized');
        }

        const nextUser: SessionUser = {
          id: data.id,
          email: data.email,
          admin: true,
          ts: Date.now(),
        };
        setStoredSession(nextUser);
        setUser(nextUser);
        return nextUser;
      },
      logout() {
        clearStoredSession();
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
