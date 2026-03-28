'use client';
import { useEffect, useState } from 'react';
import api, { cachedGet, getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import {
  CheckIcon,
  Cog6ToothIcon,
  KeyIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type OrganizationSettings = {
  business_name: string;
  business_phone: string;
  business_email: string;
  business_address: string;
  currency: string;
  reminder_days: string;
  receipt_footer: string;
  late_fee_percentage: string;
};

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState<OrganizationSettings>({
    business_name: '',
    business_phone: '',
    business_email: '',
    business_address: '',
    currency: 'TZS',
    reminder_days: '7',
    receipt_footer: '',
    late_fee_percentage: '0',
  });
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || '',
    organization_name: user?.organization_name || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setProfile({
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      role: user?.role || '',
      organization_name: user?.organization_name || '',
    });
  }, [user]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (isAdmin) {
          const data = await cachedGet<Partial<OrganizationSettings>>('/settings');
          setSettings((prev) => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, [isAdmin]);

  const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSettings((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put('/settings', settings);
      invalidateGetCache('/settings');
      toast.success('Organization settings updated successfully');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update organization settings'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }

    setSavingProfile(true);
    try {
      const { data } = await api.put('/auth/profile', {
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim(),
      });
      setUser(data.user);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update profile'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error('All password fields are required');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New password and confirmation do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const { data } = await api.put('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      toast.success(data.message || 'Password changed successfully');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to change password'));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-900 dark:text-white">Settings & Account</h2>
        <p className="text-brand-500">Manage your profile, password, and organization preferences.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_1fr]">
        <div className="glass-panel rounded-2xl p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-border/50 pb-6">
            <div className="rounded-xl bg-brand-100 p-2.5 dark:bg-brand-800">
              <UserCircleIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">My Profile</h3>
              <p className="text-sm text-brand-500">Update the account details shown across the system.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Full Name</label>
              <input
                name="full_name"
                value={profile.full_name}
                onChange={handleProfileChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Email</label>
                <input
                  value={profile.email}
                  readOnly
                  className="w-full rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-500 dark:border-brand-700 dark:bg-brand-800/80 dark:text-brand-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Phone</label>
                <input
                  name="phone"
                  value={profile.phone}
                  onChange={handleProfileChange}
                  className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Role</label>
                <input
                  value={profile.role}
                  readOnly
                  className="w-full rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium capitalize text-brand-500 dark:border-brand-700 dark:bg-brand-800/80 dark:text-brand-300"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Organization</label>
                <input
                  value={profile.organization_name}
                  readOnly
                  className="w-full rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-500 dark:border-brand-700 dark:bg-brand-800/80 dark:text-brand-300"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-70"
            >
              {savingProfile ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <CheckIcon className="h-5 w-5" />
              )}
              Save Profile
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-border/50 pb-6">
            <div className="rounded-xl bg-brand-100 p-2.5 dark:bg-brand-800">
              <KeyIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">Change Password</h3>
              <p className="text-sm text-brand-500">Use a strong password and keep it private.</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Current Password</label>
              <input
                type="password"
                name="current_password"
                value={passwordForm.current_password}
                onChange={handlePasswordChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">New Password</label>
              <input
                type="password"
                name="new_password"
                value={passwordForm.new_password}
                onChange={handlePasswordChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Confirm New Password</label>
              <input
                type="password"
                name="confirm_password"
                value={passwordForm.confirm_password}
                onChange={handlePasswordChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-70"
            >
              {changingPassword ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <KeyIcon className="h-5 w-5" />
              )}
              Update Password
            </button>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="glass-panel rounded-2xl p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-border/50 pb-6">
            <div className="rounded-xl bg-brand-100 p-2.5 dark:bg-brand-800">
              <Cog6ToothIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-brand-900 dark:text-white">Organization Settings</h3>
              <p className="text-sm text-brand-500">Only the landlord owner can change these organization preferences.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Business/Landlord Name</label>
              <input
                name="business_name"
                value={settings.business_name || ''}
                onChange={handleSettingsChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Contact Phone</label>
              <input
                name="business_phone"
                value={settings.business_phone || ''}
                onChange={handleSettingsChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Contact Email</label>
              <input
                name="business_email"
                value={settings.business_email || ''}
                onChange={handleSettingsChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Currency Code</label>
              <input
                name="currency"
                value={settings.currency || ''}
                onChange={handleSettingsChange}
                placeholder="e.g. USD, KES, TZS"
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium uppercase transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
            <div className="col-span-full space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Business Address</label>
              <textarea
                name="business_address"
                value={settings.business_address || ''}
                onChange={handleSettingsChange}
                rows={2}
                className="w-full resize-none rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
          </div>

          <div className="mb-6 mt-10 flex items-center gap-3 border-b border-border/50 pb-6">
            <div className="rounded-xl bg-brand-100 p-2.5 dark:bg-brand-800">
              <Cog6ToothIcon className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-brand-900 dark:text-white">Lease & Payment Preferences</h3>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Rent Reminder (Days Before)</label>
              <input
                type="number"
                name="reminder_days"
                value={settings.reminder_days || '7'}
                onChange={handleSettingsChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Late Fee Percentage (%)</label>
              <input
                type="number"
                name="late_fee_percentage"
                value={settings.late_fee_percentage || '0'}
                onChange={handleSettingsChange}
                className="w-full rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
            <div className="col-span-full space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Receipt Footer Message</label>
              <textarea
                name="receipt_footer"
                value={settings.receipt_footer || ''}
                onChange={handleSettingsChange}
                rows={2}
                placeholder="e.g. Thank you for your payment."
                className="w-full resize-none rounded-lg border border-brand-200 bg-white/50 px-4 py-2 text-sm font-medium transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-brand-700 dark:bg-brand-900/50"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 rounded-xl bg-primary px-8 py-2.5 text-sm font-bold tracking-wide text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-70"
            >
              {savingSettings ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <CheckIcon className="h-5 w-5" />
              )}
              Save Organization Settings
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-200 bg-white/70 px-5 py-4 text-sm text-brand-600 shadow-sm dark:border-brand-800 dark:bg-brand-900/60 dark:text-brand-300">
          Organization settings are managed by the landlord owner. Your profile and password controls are available above.
        </div>
      )}
    </div>
  );
}
