import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="text-blue-600 underline">
        Back to home
      </Link>
    </main>
  );
}
