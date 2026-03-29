import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { useAuth } from '@/hooks/useAuth';

const DashboardLayout = lazy(() => import('@/app/(dashboard)/layout'));
const LoginPage = lazy(() => import('@/app/(auth)/login/page'));
const ForgotPasswordPage = lazy(() => import('@/app/(auth)/forgot-password/page'));
const RegisterPage = lazy(() => import('@/app/(auth)/register/page'));
const ResetPasswordPage = lazy(() => import('@/app/(auth)/reset-password/[token]/page'));
const DashboardPage = lazy(() => import('@/app/(dashboard)/dashboard/page'));
const NotificationsPage = lazy(() => import('@/app/(dashboard)/notifications/page'));
const PaymentsPage = lazy(() => import('@/app/(dashboard)/payments/page'));
const RecordPaymentPage = lazy(() => import('@/app/(dashboard)/payments/new/page'));
const PropertiesPage = lazy(() => import('@/app/(dashboard)/properties/page'));
const AddPropertyPage = lazy(() => import('@/app/(dashboard)/properties/new/page'));
const PropertyDetailsPage = lazy(() => import('@/app/(dashboard)/properties/[id]/page'));
const ReportsPage = lazy(() => import('@/app/(dashboard)/reports/page'));
const SettingsPage = lazy(() => import('@/app/(dashboard)/settings/page'));
const ApprovalsPage = lazy(() => import('@/app/(dashboard)/admin/approvals/page'));
const TenantsPage = lazy(() => import('@/app/(dashboard)/tenants/page'));
const AddTenantPage = lazy(() => import('@/app/(dashboard)/tenants/new/page'));
const TenantProfilePage = lazy(() => import('@/app/(dashboard)/tenants/[id]/page'));
const TenantEditPage = lazy(() => import('@/app/(dashboard)/tenants/[id]/edit/page'));
const UnitsPage = lazy(() => import('@/app/(dashboard)/units/page'));
const AddUnitPage = lazy(() => import('@/app/(dashboard)/units/new/page'));
const UnitEditPage = lazy(() => import('@/app/(dashboard)/units/[id]/edit/page'));
const UsersPage = lazy(() => import('@/app/(dashboard)/users/page'));
const SetupAccountPage = lazy(() => import('@/app/(auth)/setup-account/[token]/page'));
const NotFoundPage = lazy(() => import('@/app/not-found/page'));

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 dark:bg-brand-950">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <DashboardLayout />;
}

function PublicOnlyRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function AppRoutes() {
  return (
    <>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register/:token"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/reset-password/:token"
            element={
              <PublicOnlyRoute>
                <ResetPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/setup-account/:token" element={<SetupAccountPage />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/properties/new" element={<AddPropertyPage />} />
            <Route path="/properties/:id" element={<PropertyDetailsPage />} />
            <Route path="/units" element={<UnitsPage />} />
            <Route path="/units/new" element={<AddUnitPage />} />
            <Route path="/units/:id/edit" element={<UnitEditPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/tenants/new" element={<AddTenantPage />} />
            <Route path="/tenants/:id" element={<TenantProfilePage />} />
            <Route path="/tenants/:id/edit" element={<TenantEditPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/payments/new" element={<RecordPaymentPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/admin/approvals" element={<ApprovalsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </>
  );
}

export default function App() {
  return (
    <ClientProviders>
      <AppRoutes />
    </ClientProviders>
  );
}
