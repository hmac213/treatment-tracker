import { getSessionUser } from '@/lib/session';
import { AdminLoginForm } from '@/components/AdminLoginForm';
import { AdminLayout } from '@/components/AdminLayout';
import { listUsers, listAllUnlocks } from '@/lib/lambdaDataClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Activity, TrendingUp, UserPlus, Edit, Search, Clock, TreePine } from 'lucide-react';
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

  const [users, allUnlocks] = await Promise.all([listUsers(), listAllUnlocks()]);
  const userCount = users.length;
  const totalUnlocks = allUnlocks.length;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const activeUserIds = new Set(
    allUnlocks.filter((u) => (u.unlocked_at ?? '') >= sevenDaysAgo).map((u) => u.user_id)
  );
  const recentActivityCount = allUnlocks.filter((u) => (u.unlocked_at ?? '') >= oneDayAgo).length;
  const progressStatsData = allUnlocks
    .sort((a, b) => (b.unlocked_at ?? '').localeCompare(a.unlocked_at ?? ''))
    .slice(0, 100)
    .map((u) => ({ user_id: u.user_id, unlocked_at: u.unlocked_at }));
  const userIdToEmail = new Map(users.map((u) => [u.id, u.email]));
  const avgProgress = userCount > 0 ? Math.round(totalUnlocks / userCount) : 0;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor patient engagement and manage the treatment system
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
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
              <CardTitle className="text-sm font-medium">Active This Week</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUserIds.size}</div>
              <p className="text-xs text-muted-foreground">
                {userCount > 0 ? Math.round((activeUserIds.size / userCount) * 100) : 0}% of all patients
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentActivityCount}</div>
              <p className="text-xs text-muted-foreground">
                Steps unlocked today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgProgress}</div>
              <p className="text-xs text-muted-foreground">
                Steps per patient
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common administrative tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">Add New Patient</p>
                      <p className="text-sm text-blue-700">Register a new user</p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Link href="/admin/users">Add User</Link>
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <Search className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">Find Patient</p>
                      <p className="text-sm text-green-700">Search and manage patient data</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="border-green-300 hover:bg-green-100">
                    <Link href="/admin/patients">Search</Link>
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    <Edit className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-purple-900">Edit Decision Tree</p>
                      <p className="text-sm text-purple-700">Modify treatment paths</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="border-purple-300 hover:bg-purple-100">
                    <Link href="/admin/tree">Open Editor</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Patient Activity</CardTitle>
              <CardDescription>
                Recent patient engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {progressStatsData.length > 0 ? (
                <div className="space-y-3">
                  {progressStatsData.slice(0, 5).map((unlock, index) => (
                    <div key={index} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium">
                            {(userIdToEmail.get(unlock.user_id) ?? 'Unknown').split('@')[0]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {unlock.unlocked_at ? new Date(unlock.unlocked_at).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-green-600 font-medium">New step unlocked</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href="/admin/patients">View All Activity</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
} 