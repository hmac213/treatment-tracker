"use client";

import { useState } from 'react';

export type Symptom = { key: string; label: string };

export function UnlockForm({ symptoms, category }: { symptoms: Symptom[]; category?: string }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  function toggle(k: string) {
    setSelected((s) => ({ ...s, [k]: !s[k] }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const chosen = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
      const res = await fetch('/api/unlock-by-symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: chosen, category }),
      });
      if (res.ok) location.href = '/me';
      else alert('Unable to unlock');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 gap-3">
        {symptoms.map((s) => (
          <label key={s.key} className="flex items-center gap-3 text-lg">
            <input type="checkbox" className="h-5 w-5" checked={!!selected[s.key]} onChange={() => toggle(s.key)} />
            {s.label}
          </label>
        ))}
      </div>
      <button type="submit" disabled={loading} className="rounded bg-green-600 text-white px-4 py-2 text-lg">
        {loading ? 'Applying…' : 'Apply'}
      </button>
    </form>
  );
} 