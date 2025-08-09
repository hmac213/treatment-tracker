"use client";

export function TopBar() {
  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      location.href = '/';
    }
  }
  return (
    <div className="w-full flex items-center justify-between py-3 px-4 border-b bg-white/60 sticky top-0 backdrop-blur">
      <div className="font-semibold text-lg">Treatment Helper</div>
      <button onClick={logout} className="rounded bg-gray-800 text-white px-3 py-1.5">Logout</button>
    </div>
  );
} 