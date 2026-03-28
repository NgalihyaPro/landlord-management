import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon, HomeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';

export default function NotFoundPage() {
  const { user } = useAuth();
  const homeHref = user ? '/dashboard' : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-6 py-12 dark:bg-brand-950">
      <div className="w-full max-w-xl rounded-[32px] border border-brand-200 bg-white p-10 text-center shadow-xl dark:border-brand-800 dark:bg-brand-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning/10 text-warning">
          <ExclamationTriangleIcon className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.25em] text-brand-500">404 Error</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-900 dark:text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-brand-500">
          The page you requested does not exist, may have moved, or may no longer be available in this landlord workspace.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            to={homeHref}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary/90"
          >
            <HomeIcon className="h-5 w-5" />
            Return to {user ? 'dashboard' : 'sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}
