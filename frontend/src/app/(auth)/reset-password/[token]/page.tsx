import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BuildingOfficeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '@/lib/api';

type ResetPasswordDetails = {
  email: string;
  full_name: string | null;
  organization_name: string;
  expires_at: string;
};

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState<ResetPasswordDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const loadResetDetails = async () => {
      if (!token) {
        setErrorMessage('Password reset link is invalid.');
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get<ResetPasswordDetails>(`/auth/reset-password/${token}`);
        setDetails(data);
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, 'Password reset link is invalid or expired.'));
      } finally {
        setLoading(false);
      }
    };

    void loadResetDetails();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setErrorMessage('Password reset link is invalid.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const { data } = await api.post('/auth/reset-password', {
        token,
        password,
      });
      toast.success(data.message || 'Password reset successfully.');
      navigate('/login', { replace: true });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to reset password.');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50 dark:bg-brand-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 px-6 py-10 text-brand-900 dark:bg-brand-950 dark:text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-center gap-3 text-primary">
          <BuildingOfficeIcon className="h-10 w-10" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-500 dark:text-brand-400">LandlordPro</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Choose a New Password</h1>
          </div>
        </div>

        <div className="rounded-3xl border border-brand-200 bg-white p-8 shadow-xl dark:border-brand-800 dark:bg-brand-900">
          {details ? (
            <>
              <div className="mb-6 rounded-2xl bg-primary/5 p-4 text-sm text-brand-600 dark:text-brand-300">
                <p>
                  Resetting password for <span className="font-semibold text-primary">{details.email}</span>
                </p>
                <p className="mt-1">Organization: {details.organization_name}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="reset-password" className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    New Password
                  </label>
                  <div className="relative mt-1">
                    <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-12 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-primary"
                    >
                      {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reset-confirm-password" className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    Confirm New Password
                  </label>
                  <div className="relative mt-1">
                    <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-12 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-primary"
                    >
                      {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Resetting password...' : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-6 text-center text-danger">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 border-t border-brand-100 pt-6 dark:border-brand-800">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80">
              <ArrowLeftIcon className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
