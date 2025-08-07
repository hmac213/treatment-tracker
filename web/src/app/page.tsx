import Link from 'next/link';
import { getSessionUser } from '@/lib/session';
import { LoginForm } from '@/components/LoginForm';

export default async function Home() {
  const user = await getSessionUser();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold mb-4">Treatment Helper</h1>
      {!user ? (
        <div className="space-y-3">
          <p className="text-lg">Enter your email to continue:</p>
          <LoginForm />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-lg">Welcome, {user.email}</p>
          <Link href="/me" className="inline-block rounded bg-blue-600 text-white px-4 py-2 text-lg">View your path</Link>
        </div>
      )}
    </main>
  );
}
