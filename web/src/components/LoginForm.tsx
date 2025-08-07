"use client";

import { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        location.reload();
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Login failed' }));
        alert(error ?? 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex gap-2" onSubmit={onSubmit}>
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.org"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded border px-3 py-2 text-lg"
      />
      <button type="submit" disabled={loading} className="rounded bg-blue-600 text-white px-4 py-2 text-lg">
        {loading ? 'Please wait…' : 'Continue'}
      </button>
    </form>
  );
} 