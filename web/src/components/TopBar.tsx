"use client";

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';

export function TopBar() {
  const navigate = useNavigate();
  const { logout: clearSession } = useAuth();

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      clearSession();
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="w-full flex items-center justify-between py-3 px-4 border-b bg-white/60 sticky top-0 backdrop-blur z-50">
      <div className="font-semibold text-lg">Treatment Helper</div>
      <button onClick={logout} className="rounded bg-gray-800 text-white px-3 py-1.5">Logout</button>
    </div>
  );
}
