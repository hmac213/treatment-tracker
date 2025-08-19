import { getSessionUser } from '@/lib/session';
import { AdminLayout } from '@/components/AdminLayout';
import { PatientLookup } from '@/components/PatientLookup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { redirect } from 'next/navigation';

export default async function AdminPatientsPage() {
  const user = await getSessionUser();
  if (!user?.admin) {
    redirect('/admin');
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patient Lookup</h1>
          <p className="text-muted-foreground">
            Search for patients and manage their treatment progress
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Patients</CardTitle>
            <CardDescription>
              Find patients by name or email to view and manage their progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PatientLookup />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
