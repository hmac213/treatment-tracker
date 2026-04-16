import { Navigate, Link } from 'react-router-dom';
import { LoginForm } from '@/components/LoginForm';
import { useAuth } from '@/components/AuthProvider';
import { BrandLogo } from '@/components/BrandLogo';

export function HomePage() {
  const { user } = useAuth();
  if (user) {
    return <Navigate to="/me" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8">
          <div className="text-center space-y-4 max-w-2xl">
            <BrandLogo imageClassName="h-20 w-auto mx-auto" className="justify-center mb-2" showProductName={false} />
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Treatment Helper</h1>
          </div>
          <div className="w-full max-w-md">
            <LoginForm />
          </div>
          <Link to="/admin" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Admin login
          </Link>
        </div>
      </main>
    </div>
  );
}
