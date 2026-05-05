import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BuildingOfficeIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  PhoneIcon,
  UserIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import api, { getApiErrorMessage, getGoogleAuthUrl } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';

type InviteDetails = {
  email: string;
  full_name: string | null;
  expires_at: string;
  invited_by_email: string | null;
};

export default function RegisterPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();
  const tx = t('auth.register');
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(Boolean(token));
  const googleVerified = searchParams.get('google_verified') === '1';
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    business_name: '',
    business_phone: '',
    business_address: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const googleError = searchParams.get('google_error');
    if (googleError) {
      setErrorMessage(googleError);
      toast.error(googleError);
    }

    const loadInvite = async () => {
      if (!token) {
        setInviteLoading(false);
        return;
      }

      try {
        const { data } = await api.get<InviteDetails>(`/auth/register/${token}`);
        setInvite(data);
        setFormData((current) => ({
          ...current,
          full_name: current.full_name || data.full_name || '',
          email: data.email,
        }));
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, tx.invite_invalid));
      } finally {
        setInviteLoading(false);
      }
    };

    void loadInvite();
  }, [token, searchParams]);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setErrorMessage(tx.invite_required);
      return;
    }

    if (!formData.full_name || !formData.business_name || !formData.email || (!googleVerified && !formData.password)) {
      setErrorMessage(tx.required_fields);
      return;
    }

    if (!googleVerified && formData.password.length < 8) {
      setErrorMessage(tx.password_length);
      return;
    }

    if (!googleVerified && formData.password !== formData.confirmPassword) {
      setErrorMessage(tx.password_mismatch);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        token,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        business_name: formData.business_name.trim(),
        business_phone: formData.business_phone.trim(),
        business_address: formData.business_address.trim(),
      };

      const { data } = await api.post(
        googleVerified ? '/auth/register/invite/google' : '/auth/register/invite',
        googleVerified ? payload : { ...payload, password: formData.password }
      );

      toast.success(data.message || tx.success);
      if (data.user) {
        login(data.user);
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err: any) {
      const message = getApiErrorMessage(err, tx.failed);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleVerify = () => {
    if (!token) return;
    window.location.href = getGoogleAuthUrl('owner_register', token);
  };

  return (
    <div className="min-h-screen bg-brand-50 px-6 py-10 text-brand-900 dark:bg-brand-950 dark:text-white">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden overflow-hidden rounded-[32px] bg-brand-900 p-10 text-white shadow-2xl lg:block">
          <div className="relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-primary/80 via-brand-800 to-brand-950 p-10">
            <div className="absolute left-12 top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-8 right-8 h-56 w-56 rounded-full bg-info/20 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="mb-8 flex items-center gap-3">
                  <img src="/logo.png" alt="LandlordPro logo" className="h-12 w-auto object-contain" />
                </div>
                <h1 className="max-w-lg text-5xl font-black leading-tight">
                  {tx.hero_title}
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-brand-100/90">
                  {tx.hero_desc}
                </p>
              </div>

              <div className="grid gap-4 text-sm text-brand-100/90">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{tx.bullet_invite_only}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{tx.bullet_workspace}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{tx.bullet_staff}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{tx.bullet_ready}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-brand-200 bg-white p-8 shadow-xl dark:border-brand-800 dark:bg-brand-900 sm:p-10">
          <div className="mb-8">
            <div className="mb-5 flex items-center gap-3 text-primary lg:hidden">
              <img src="/logo.png" alt="LandlordPro logo" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-500">{tx.owner_registration}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-brand-900 dark:text-white">{tx.create_account}</h2>
            <p className="mt-2 text-sm text-brand-500">
              {token
                ? tx.invite_complete
                : tx.invite_only_notice}
            </p>
          </div>

          {inviteLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !token || !invite ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-warning/20 bg-warning/5 px-5 py-4 text-sm text-brand-700 dark:text-brand-200">
                {tx.invalid_invite_required}
              </div>
              {errorMessage && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
                  {errorMessage}
                </div>
              )}
              <div className="rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 text-sm text-brand-600 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300">
                {tx.contact_admin}
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-brand-700 dark:text-brand-200">
              {tx.secure_link_for} <span className="font-semibold">{invite.email}</span>.
            </div>
            {googleVerified ? (
              <div className="rounded-2xl border border-info/20 bg-info/5 px-4 py-3 text-sm text-brand-700 dark:text-brand-200">
                Google verified this invited email. Complete the business details to create the account without a password.
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleVerify}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50 dark:border-brand-700 dark:bg-brand-950 dark:text-white dark:hover:bg-brand-900"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-brand-200 text-sm font-black text-[#4285f4]">G</span>
                Continue with Google
              </button>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{tx.owner_name}</label>
                <div className="relative mt-1">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                  <input
                    value={formData.full_name}
                    onChange={(e) => updateField('full_name', e.target.value)}
                    className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                    placeholder="John Mwangi"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{tx.owner_phone}</label>
                <div className="relative mt-1">
                  <PhoneIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                  <input
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                    placeholder="+255..."
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{tx.business_email}</label>
              <div className="relative mt-1">
                <EnvelopeIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{tx.business_name}</label>
                <div className="relative mt-1">
                  <BuildingOfficeIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                  <input
                    value={formData.business_name}
                    onChange={(e) => updateField('business_name', e.target.value)}
                    className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                    placeholder="Mwangi Property Group"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{tx.business_phone}</label>
                <div className="relative mt-1">
                  <PhoneIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                  <input
                    value={formData.business_phone}
                    onChange={(e) => updateField('business_phone', e.target.value)}
                    className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                    placeholder="+255..."
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{tx.business_address}</label>
              <div className="relative mt-1">
                <MapPinIcon className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-brand-400" />
                <textarea
                  value={formData.business_address}
                  onChange={(e) => updateField('business_address', e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-brand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                  placeholder="Dar es Salaam, Tanzania"
                />
              </div>
            </div>

            {!googleVerified && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{tx.password}</label>
                <div className="relative mt-1">
                  <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
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
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{tx.confirm_password}</label>
                <div className="relative mt-1">
                  <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => updateField('confirmPassword', e.target.value)}
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
            </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? tx.creating : googleVerified ? 'Create Account with Google' : tx.create_button}
            </button>
          </form>
          )}

          <p className="mt-6 text-center text-sm text-brand-500">
            {tx.already_have_account}{' '}
            <Link to="/login" className="font-semibold text-primary hover:text-primary/80">
              {tx.signin_here}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
