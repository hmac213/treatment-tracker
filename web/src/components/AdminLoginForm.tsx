"use client";

import { useState } from 'react';

export function AdminLoginForm() {
  const [email, setEmail] = useState('admin@example.org');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        location.href = '/admin';
      } else {
        alert('Invalid admin credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium">Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded border px-3 py-2" />
      </div>
      <button type="submit" disabled={loading} className="rounded bg-blue-700 text-white px-4 py-2">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
} 