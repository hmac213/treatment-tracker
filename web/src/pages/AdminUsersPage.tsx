import { AdminAddUserForm } from '@/components/AdminAddUserForm';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminUsersPage() {
  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add Users</h1>
          <p className="text-muted-foreground">Add new patients to the treatment tracker system</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
            <CardDescription>Enter the patient&apos;s information to create their account</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminAddUserForm />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
