import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BuildingOfficeIcon,
  EnvelopeIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import api, { getApiErrorMessage } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setErrorMessage('Email is required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setResetLink('');

    try {
      const { data } = await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });

      setSuccessMessage(data.message || 'If an account matches that email, a reset link has been sent.');
      setResetLink(data.reset_link || '');
      toast.success('Password reset request submitted.');
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to request password reset.');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copyResetLink = async () => {
    if (!resetLink) return;

    try {
      await navigator.clipboard.writeText(resetLink);
      toast.success('Reset link copied.');
    } catch {
      toast.error('Failed to copy the reset link.');
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 px-6 py-10 text-brand-900 dark:bg-brand-950 dark:text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-center gap-3 text-primary">
          <BuildingOfficeIcon className="h-10 w-10" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-500 dark:text-brand-400">LandlordPro</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Reset Your Password</h1>
          </div>
        </div>

        <div className="rounded-3xl border border-brand-200 bg-white p-8 shadow-xl dark:border-brand-800 dark:bg-brand-900">
          <p className="text-sm text-brand-500">
            Enter the email you use to sign in. If the account is active, we will send a secure password reset link.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="forgot-email" className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                Email Address
              </label>
              <div className="relative mt-1">
                <EnvelopeIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) {
                      setErrorMessage('');
                    }
                  }}
                  className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm font-medium text-success">
                {successMessage}
              </div>
            )}

            {resetLink && (
              <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
                <p className="text-sm font-semibold text-success">Development reset link</p>
                <p className="mt-2 break-all text-sm text-brand-700 dark:text-brand-200">{resetLink}</p>
                <button
                  type="button"
                  onClick={copyResetLink}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:bg-success/90"
                >
                  <ClipboardDocumentIcon className="h-4 w-4" />
                  Copy Reset Link
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Sending reset link...' : 'Send Reset Link'}
            </button>
          </form>

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
