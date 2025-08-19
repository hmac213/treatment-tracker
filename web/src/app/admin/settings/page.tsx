import { AdminLayout } from '@/components/AdminLayout';
import { AdminSettingsClient } from '@/components/AdminSettingsClient';
import { Card } from '@/components/ui/card';

export default async function AdminSettingsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground">
            Manage system settings and perform administrative tasks
          </p>
        </div>
        
        <Card className="p-6">
          <AdminSettingsClient />
        </Card>
      </div>
    </AdminLayout>
  );
}
