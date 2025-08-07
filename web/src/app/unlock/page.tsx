import { createServiceClient } from '@/lib/supabaseClient';
import { getSessionUser } from '@/lib/session';
import Link from 'next/link';
import { UnlockForm, Symptom } from '@/components/UnlockForm';

export default async function UnlockPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-lg">Please go back and enter your email.</p>
        <Link href="/" className="text-blue-600 underline">Back to home</Link>
      </main>
    );
  }

  const supabase = createServiceClient();
  const { data: symptoms } = await supabase.from('symptoms').select('key,label').order('label');

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Unlock next steps</h1>
      <UnlockForm symptoms={(symptoms ?? []) as Symptom[]} />
      <Link href="/me" className="text-blue-600 underline">Back to my path</Link>
    </main>
  );
} 