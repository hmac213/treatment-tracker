export type SessionUser = {
  id: string;
  email: string;
  ts: number;
  admin?: boolean;
};

const STORAGE_KEY = 'treatment-tracker-session';

export function getStoredSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setStoredSession(user: SessionUser) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}
