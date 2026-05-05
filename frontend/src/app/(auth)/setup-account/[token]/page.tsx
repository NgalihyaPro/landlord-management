import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api, { getApiErrorMessage, getGoogleAuthUrl } from '@/lib/api';
import { toast } from 'sonner';
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  PhoneIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';

type InvitationDetails = {
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  organization_name: string;
  invite_expires_at: string;
};

export default function SetupAccountPage() {
  const { language } = useLanguage();
  const isSw = language === 'sw';
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const googleError = searchParams.get('google_error');
    if (googleError) {
      setErrorMessage(googleError);
      toast.error(googleError);
    }

    const loadInvitation = async () => {
      try {
        const { data } = await api.get<InvitationDetails>(`/auth/setup-account/${token}`);
        setInvitation(data);
        setFormData((current) => ({
          ...current,
          full_name: data.full_name || '',
          phone: data.phone || '',
        }));
      } catch (err: any) {
        setErrorMessage(getApiErrorMessage(err, isSw ? 'Kiungo cha mualiko si sahihi au muda wake umeisha.' : 'Invitation link is invalid or expired.'));
      } finally {
        setLoading(false);
      }
    };

    if (!token) {
      setErrorMessage(isSw ? 'Kiungo cha mualiko si sahihi.' : 'Invitation link is invalid.');
      setLoading(false);
      return;
    }

    loadInvitation();
  }, [token, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (formData.password.length < 8) {
      setErrorMessage(isSw ? 'Nenosiri lazima liwe na herufi 8 au zaidi.' : 'Password must be at least 8 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage(isSw ? 'Manenosiri hayalingani.' : 'Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const { data } = await api.post('/auth/setup-account', {
        token,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
      });

      toast.success(isSw ? 'Usanidi wa akaunti umekamilika. Karibu!' : 'Account setup completed. Welcome aboard!');
      login(data.user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const message = getApiErrorMessage(err, isSw ? 'Imeshindikana kukamilisha usanidi wa akaunti.' : 'Failed to complete account setup.');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSetup = () => {
    if (!token) return;
    window.location.href = getGoogleAuthUrl('staff_setup', token);
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
        <div className="mb-8 flex flex-col items-center justify-center gap-3 text-primary">
          <img src="/logo.png" alt="LandlordPro logo" className="h-12 w-auto object-contain" />
          <h1 className="text-3xl font-extrabold tracking-tight">{isSw ? 'Kamilisha Akaunti Yako' : 'Set Up Your Account'}</h1>
        </div>

        <div className="rounded-3xl border border-brand-200 bg-white p-8 shadow-xl dark:border-brand-800 dark:bg-brand-900">
          {invitation ? (
            <>
              <div className="mb-6 rounded-2xl bg-primary/5 p-4">
                <p className="text-sm text-brand-600 dark:text-brand-300">
                  {isSw ? 'Umealikwa kujiunga na' : 'You were invited to join'} <span className="font-semibold text-primary">{invitation.organization_name}</span> {isSw ? 'kama' : 'as a'}{' '}
                  <span className="font-semibold capitalize text-primary">{invitation.role}</span>.
                </p>
                <p className="mt-2 text-sm text-brand-500 dark:text-brand-400">{invitation.email}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="setup-full-name" className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    {isSw ? 'Jina Kamili' : 'Full Name'}
                  </label>
                  <div className="relative mt-1">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      id="setup-full-name"
                      value={formData.full_name}
                      onChange={(e) => setFormData((current) => ({ ...current, full_name: e.target.value }))}
                      className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="setup-phone" className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    {isSw ? 'Namba ya Simu' : 'Phone Number'}
                  </label>
                  <div className="relative mt-1">
                    <PhoneIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      id="setup-phone"
                      value={formData.phone}
                      onChange={(e) => setFormData((current) => ({ ...current, phone: e.target.value }))}
                      className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                      placeholder={isSw ? '+255...' : '+255...'}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="setup-password" className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    {isSw ? 'Tengeneza Nenosiri' : 'Create Password'}
                  </label>
                  <div className="relative mt-1">
                    <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      id="setup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
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
                  <label htmlFor="setup-confirm-password" className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    {isSw ? 'Thibitisha Nenosiri' : 'Confirm Password'}
                  </label>
                  <div className="relative mt-1">
                    <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                    <input
                      id="setup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData((current) => ({ ...current, confirmPassword: e.target.value }))}
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
                  {submitting ? (isSw ? 'Inakamilisha akaunti...' : 'Setting up account...') : (isSw ? 'Kamilisha Usanidi wa Akaunti' : 'Complete Account Setup')}
                </button>

                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-brand-400">
                  <span className="h-px flex-1 bg-brand-200 dark:bg-brand-700" />
                  {isSw ? 'au' : 'or'}
                  <span className="h-px flex-1 bg-brand-200 dark:bg-brand-700" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSetup}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-brand-700 dark:bg-brand-950 dark:text-white dark:hover:bg-brand-900"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-brand-200 text-sm font-black text-[#4285f4]">G</span>
                  {isSw ? 'Endelea na Google' : 'Continue with Google'}
                </button>
              </form>
            </>
          ) : (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-6 text-center text-danger">
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
