"use client";

import { useState } from 'react';

export function AdminAddUserForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      if (res.ok) {
        setEmail('');
        setName('');
        alert('User added');
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Failed' }));
        alert(error ?? 'Failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 max-w-xl">
      <input name="email" type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 rounded border px-3 py-2" />
      <input name="name" type="text" required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded border px-3 py-2" />
      <button className="rounded bg-green-700 text-white px-4 py-2" disabled={loading}>{loading ? 'Adding…' : 'Add'}</button>
    </form>
  );
} 