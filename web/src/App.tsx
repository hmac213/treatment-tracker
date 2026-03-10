import { Navigate, Route, Routes } from 'react-router-dom';
import { ConditionalTopBar } from '@/components/ConditionalTopBar';
import { useAuth } from '@/components/AuthProvider';
import { HomePage } from '@/pages/HomePage';
import { MePage } from '@/pages/MePage';
import { UnlockPage } from '@/pages/UnlockPage';
import { AdminDashboardPage } from '@/pages/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { AdminPatientsPage } from '@/pages/AdminPatientsPage';
import { AdminTreePage } from '@/pages/AdminTreePage';
import { AdminSettingsPage } from '@/pages/AdminSettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function RequireUser({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.admin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <ConditionalTopBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/me"
          element={
            <RequireUser>
              <MePage />
            </RequireUser>
          }
        />
        <Route
          path="/unlock"
          element={
            <RequireUser>
              <UnlockPage />
            </RequireUser>
          }
        />
        <Route
          path="/unlock/:category"
          element={
            <RequireUser>
              <UnlockPage />
            </RequireUser>
          }
        />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <AdminUsersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/patients"
          element={
            <RequireAdmin>
              <AdminPatientsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/tree"
          element={
            <RequireAdmin>
              <AdminTreePage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireAdmin>
              <AdminSettingsPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
