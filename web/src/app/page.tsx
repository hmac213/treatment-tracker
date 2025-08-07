import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { LoginForm } from '@/components/LoginForm';

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect('/me');
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold mb-4">Treatment Helper</h1>
      <div className="space-y-3">
        <p className="text-lg">Enter your email to continue:</p>
        <LoginForm />
      </div>
    </main>
  );
}
