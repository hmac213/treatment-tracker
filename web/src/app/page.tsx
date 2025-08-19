import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { LoginForm } from '@/components/LoginForm';
import { Heart } from 'lucide-react';

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect('/me');
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8">
          {/* Header Section */}
          <div className="text-center space-y-4 max-w-2xl">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-full">
                <Heart className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                Treatment Helper
              </h1>
            </div>
          </div>

          {/* Login Form */}
          <div className="w-full max-w-md">
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
