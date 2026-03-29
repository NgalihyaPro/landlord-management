import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import api, { getApiErrorMessage } from '@/lib/api';
import {
  BuildingOfficeIcon,
  LockClosedIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

const isProduction = import.meta.env.PROD;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  const clearErrors = () => {
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });
      toast.success(`Welcome back, ${data.user.full_name}!`);
      login(data.user);
    } catch (err: any) {
      const message = getApiErrorMessage(err, 'Invalid credentials');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex text-brand-900 dark:text-white">
      <div className="hidden lg:flex w-1/2 flex-col justify-center items-center bg-brand-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-brand-800 to-brand-950 opacity-90" />
        <div className="absolute top-20 left-20 h-64 w-64 rounded-full bg-primary opacity-30 blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-info/80 opacity-30 blur-3xl animate-pulse delay-700" />

        <div className="relative z-10 p-12 text-center text-white">
          <BuildingOfficeIcon className="mx-auto mb-6 h-24 w-24 text-white/90 drop-shadow-2xl" />
          <h1 className="mb-4 text-5xl font-extrabold tracking-tight drop-shadow-lg">LandlordPro</h1>
          <p className="mx-auto max-w-md text-xl font-medium leading-relaxed text-brand-100/90">
            The intelligent, modern property management system designed exclusively for proactive landlords.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-brand-50 p-4 sm:p-8 dark:bg-brand-950 lg:w-1/2">
        <div className="relative w-full max-w-md space-y-8 overflow-hidden rounded-2xl p-6 sm:p-10 shadow-xl glass-panel">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

          <div className="relative z-10 text-center">
            <div className="mb-5 flex items-center justify-center gap-2 text-primary lg:hidden">
              <BuildingOfficeIcon className="h-8 w-8" />
              <span className="text-2xl font-extrabold tracking-tight">LandlordPro</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-brand-900 dark:text-white">Welcome Back</h2>
            <p className="mt-2 text-sm text-brand-500">Sign in to your dashboard to manage properties</p>
          </div>

          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            <div className="rounded-xl border border-brand-200/80 bg-white/70 px-4 py-3 text-sm text-brand-600 dark:border-brand-800 dark:bg-brand-900/70 dark:text-brand-300">
              <div className="flex items-start gap-3">
                <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>Landlord owners and staff should sign in with the secure account already created for them. If you do not have access yet, request an invite from the platform administrator or your landlord owner.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <EnvelopeIcon className="h-5 w-5 text-brand-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearErrors();
                    }}
                    className="block w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 leading-5 text-brand-900 placeholder-brand-400 transition duration-150 ease-in-out focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-sm dark:border-brand-700 dark:bg-brand-900 dark:text-white"
                    placeholder="admin@landlordpro.com"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <LockClosedIcon className="h-5 w-5 text-brand-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearErrors();
                    }}
                    onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                    onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                    className="block w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-12 leading-5 text-brand-900 placeholder-brand-400 transition duration-150 ease-in-out focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-sm dark:border-brand-700 dark:bg-brand-900 dark:text-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-400 transition-colors hover:text-primary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
                {capsLockOn && (
                  <p className="mt-2 text-xs font-medium text-warning">Caps Lock is on.</p>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center overflow-hidden rounded-xl border border-transparent bg-primary px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary/90 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="absolute inset-0 h-full w-full origin-left scale-x-0 bg-white/20 transition-transform duration-300 ease-out group-hover:scale-x-100" />
              <span className="relative flex items-center gap-2">
                {loading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In to Dashboard'
                )}
              </span>
            </button>
          </form>

          {!isProduction && (
            <div className="mt-6 border-t border-brand-100 pt-6 text-center dark:border-brand-800">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-500">Demo Access</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('manager@landlordpro.com');
                    setPassword('Manager123!');
                    setErrorMessage('');
                  }}
                  className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-200 dark:bg-brand-800 dark:text-brand-300 dark:hover:bg-brand-700"
                >
                  Auto-fill Manager
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-brand-100 pt-6 text-center dark:border-brand-800">
            <p className="text-sm text-brand-500">
              Need landlord owner access? Contact the platform administrator for your secure registration link.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
