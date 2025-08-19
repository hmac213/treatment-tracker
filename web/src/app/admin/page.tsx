import { getSessionUser } from '@/lib/session';
import { AdminLoginForm } from '@/components/AdminLoginForm';
import { AdminLayout } from '@/components/AdminLayout';
import { createServiceClient } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, TreePine, Unlock, UserPlus, Edit } from 'lucide-react';
import Link from 'next/link';

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user?.admin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
        <main className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8">
            {/* Header Section */}
            <div className="text-center space-y-4 max-w-2xl">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-3 bg-orange-100 rounded-full">
                  <TreePine className="h-8 w-8 text-orange-600" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                  Treatment Tracker Admin
                </h1>
              </div>
            </div>

            {/* Admin Login Form */}
            <div className="w-full max-w-md">
              <AdminLoginForm />
            </div>

            {/* Back to Main Site Link */}
            <div className="text-center pt-8">
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Back to main site
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Get some dashboard stats
  const supabase = createServiceClient();
  const [
    { count: userCount },
    { count: nodeCount },
    { count: unlockCount }
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('nodes').select('*', { count: 'exact', head: true }),
    supabase.from('user_unlocked_nodes').select('*', { count: 'exact', head: true })
  ]);

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of the treatment tracker system
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Registered patients
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Treatment Nodes</CardTitle>
              <TreePine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nodeCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Available treatment steps
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Unlocks</CardTitle>
              <Unlock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unlockCount ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Patient progress entries
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add New User
                  </CardTitle>
                  <CardDescription>
                    Quickly add a new patient to the system
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild size="sm">
                    <Link href="/admin/users">Add User</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Decision Tree
                  </CardTitle>
                  <CardDescription>
                    Modify treatment paths and unlock conditions
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild size="sm">
                    <Link href="/admin/tree">Open Editor</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
} 