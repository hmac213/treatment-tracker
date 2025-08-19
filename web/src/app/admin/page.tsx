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
      <main className="mx-auto max-w-3xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Admin sign in</h1>
        <AdminLoginForm />
      </main>
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