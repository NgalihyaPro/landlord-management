import { useEffect, useMemo, useState } from 'react';
import api, { cachedGet, getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlusIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
  NoSymbolIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'all';

type Registration = {
  id: number;
  name: string;
  owner_email: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  approval_status: Exclude<ApprovalStatus, 'all'>;
  approval_notes: string | null;
  approved_at: string | null;
  approved_by_email: string | null;
  created_at: string;
  owner_name: string | null;
  owner_login_email: string | null;
  owner_phone: string | null;
};

const STATUS_OPTIONS: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'all'];

const getStatusBadge = (registration: Registration, isSw: boolean) => {
  if (registration.approval_status === 'approved' && !registration.is_active) {
    return {
      label: isSw ? 'imezuiwa' : 'restricted',
      className: 'bg-danger/10 text-danger',
    };
  }

  if (registration.approval_status === 'approved') {
    return {
      label: isSw ? 'imekubaliwa' : 'approved',
      className: 'bg-success/10 text-success',
    };
  }

  if (registration.approval_status === 'rejected') {
    return {
      label: isSw ? 'imekataliwa' : 'rejected',
      className: 'bg-danger/10 text-danger',
    };
  }

  return {
    label: isSw ? 'inasubiri' : 'pending',
    className: 'bg-warning/10 text-warning',
  };
};

export default function ApprovalsPage() {
  const { language } = useLanguage();
  const isSw = language === 'sw';
  const [status, setStatus] = useState<ApprovalStatus>('pending');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
  });

  const endpoint = useMemo(
    () => `/platform-admin/registrations${status === 'pending' ? '' : `?status=${status}`}`,
    [status]
  );

  const fetchRegistrations = async (force = false) => {
    try {
      setLoading(true);
      const data = await cachedGet<Registration[]>(endpoint, { force });
      setRegistrations(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kupakia usajili wa landlord.' : 'Failed to load landlord registrations.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRegistrations();
  }, [endpoint]);

  const resetInviteForm = () => {
    setInviteForm({ email: '', full_name: '' });
    setInviteLink('');
    setInviteSubmitting(false);
  };

  const openInviteModal = () => {
    resetInviteForm();
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteSubmitting(false);
  };

  const refreshAfterAction = async () => {
    invalidateGetCache('/platform-admin/registrations');
    await fetchRegistrations(true);
  };

  const handleDecision = async (registration: Registration, action: 'approve' | 'reject') => {
    const notes = window.prompt(
      action === 'approve'
        ? (isSw ? 'Maelezo ya kukubali (hiari)' : 'Optional approval note')
        : (isSw ? 'Sababu ya kukataa (hiari)' : 'Optional rejection reason')
    ) || '';

    setActiveId(registration.id);
    try {
      await api.put(`/platform-admin/registrations/${registration.id}/${action}`, {
        notes: notes.trim() || undefined,
      });
      toast.success(
        action === 'approve'
          ? (isSw ? `${registration.name} imekubaliwa.` : `${registration.name} has been approved.`)
          : (isSw ? `${registration.name} imekataliwa.` : `${registration.name} has been rejected.`)
      );
      await refreshAfterAction();
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          action === 'approve'
            ? (isSw ? 'Imeshindikana kukubali usajili.' : 'Failed to approve registration.')
            : (isSw ? 'Imeshindikana kukataa usajili.' : 'Failed to reject registration.')
        )
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleAccessAction = async (registration: Registration, action: 'restrict' | 'restore') => {
    const actionLabel = action === 'restrict'
      ? (isSw ? 'kuzuia ufikiaji wa' : 'restrict access to')
      : (isSw ? 'kurudisha ufikiaji wa' : 'restore access to');
    const confirmMessage =
      action === 'restrict'
        ? (isSw
          ? `Unataka kuzuia ufikiaji wa ${registration.name}? Watumiaji wote wa akaunti hii hawataweza kuingia hadi urudishe ufikiaji.`
          : `Restrict access for ${registration.name}? All users in this landlord account will be blocked from signing in until you restore access.`)
        : (isSw
          ? `Unataka kurudisha ufikiaji wa ${registration.name}? Watumiaji waliokubaliwa wataweza kuingia tena.`
          : `Restore access for ${registration.name}? Approved users in this landlord account will be able to sign in again.`);

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const notes = window.prompt(
      action === 'restrict'
        ? (isSw ? 'Maelezo ya zuio (hiari)' : 'Optional restriction note')
        : (isSw ? 'Maelezo ya kurejesha (hiari)' : 'Optional restore note')
    ) || '';

    setActiveId(registration.id);
    try {
      await api.put(`/platform-admin/registrations/${registration.id}/${action}`, {
        notes: notes.trim() || undefined,
      });
      toast.success(isSw ? `Ufikiaji wa ${registration.name} umesasishwa.` : `${registration.name} access updated successfully.`);
      await refreshAfterAction();
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          `Failed to ${actionLabel} ${registration.name}.`
        )
      );
    } finally {
      setActiveId(null);
    }
  };

  const handleDelete = async (registration: Registration) => {
    const confirmed = window.confirm(
      isSw
        ? `Ufute ${registration.name} kabisa? Hii itaondoa akaunti ya landlord, watumiaji, mali, wapangaji, na malipo yote yanayohusiana. Huwezi kurudisha.`
        : `Delete ${registration.name} permanently? This will remove the landlord account, users, properties, tenants, and payments tied to it. This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setActiveId(registration.id);
    try {
      await api.delete(`/platform-admin/registrations/${registration.id}`);
      toast.success(isSw ? `${registration.name} imefutwa kabisa.` : `${registration.name} was deleted permanently.`);
      await refreshAfterAction();
    } catch (error) {
      toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kufuta akaunti ya landlord.' : 'Failed to delete landlord account.'));
    } finally {
      setActiveId(null);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSubmitting(true);

    try {
      const { data } = await api.post('/platform-admin/owner-invites', {
        email: inviteForm.email.trim().toLowerCase(),
        full_name: inviteForm.full_name.trim(),
      });
      setInviteLink(data.invite_link || '');
      toast.success(
        data.invite_link
          ? (isSw ? 'Barua ya usajili wa landlord imetumwa. Kiungo cha development kipo hapa chini.' : 'Landlord registration email sent. Development link is available below.')
          : (isSw ? 'Barua ya usajili wa landlord imetumwa.' : 'Landlord registration email sent.')
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, isSw ? 'Imeshindikana kuunda kiungo cha usajili wa landlord.' : 'Failed to create landlord registration link.'));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success(isSw ? 'Kiungo cha usajili kimenakiliwa.' : 'Registration link copied.');
    } catch {
      toast.error(isSw ? 'Imeshindikana kunakili kiungo cha usajili.' : 'Failed to copy the registration link.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">{isSw ? 'Ukaguzi wa Landlord' : 'Landlord Approvals'}</h2>
          <p className="text-brand-500">
            {isSw
              ? 'Tuma mialiko salama ya usajili kwa wenye landlord na pitia usajili unaosubiri.'
              : 'Email secure registration invites to landlord owners and review any pending registrations.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={openInviteModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <PlusIcon className="h-5 w-5" />
            {isSw ? 'Tengeneza Mualiko wa Landlord' : 'Create Landlord Invite'}
          </button>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ApprovalStatus)}
            className="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium dark:border-brand-700 dark:bg-brand-900 dark:text-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all'
                  ? (isSw ? 'Usajili wote' : 'All registrations')
                  : (isSw
                    ? `${option === 'pending' ? 'Usajili unaosubiri' : option === 'approved' ? 'Usajili uliokubaliwa' : 'Usajili uliokataliwa'}`
                    : `${option.charAt(0).toUpperCase()}${option.slice(1)} registrations`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl shadow-sm">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : registrations.length === 0 ? (
          <div className="p-10 text-center text-brand-500">{isSw ? 'Hakuna usajili wa landlord kwa kichujio hiki.' : 'No landlord registrations found for this filter.'}</div>
        ) : (
          <div className="divide-y divide-border/50">
            {registrations.map((registration) => {
              const badge = getStatusBadge(registration, isSw);

              return (
              <div key={registration.id} className="p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-brand-900 dark:text-white">{registration.name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-brand-500">
                        {isSw ? 'Imewasilishwa' : 'Submitted'} {formatDate(registration.created_at)}
                      </p>
                    </div>

                    <div className="grid gap-3 text-sm text-brand-600 dark:text-brand-300 md:grid-cols-2">
                      <div>
                        <p className="font-semibold text-brand-900 dark:text-white">{isSw ? 'Mmiliki' : 'Owner'}</p>
                        <p>{registration.owner_name || (isSw ? 'Bado haijawekwa' : 'Not captured yet')}</p>
                        <p>{registration.owner_login_email || registration.owner_email}</p>
                        <p>{registration.owner_phone || registration.phone || (isSw ? 'Hakuna simu' : 'No phone provided')}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-brand-900 dark:text-white">{isSw ? 'Taarifa za biashara' : 'Business details'}</p>
                        <p>{registration.owner_email}</p>
                        <p>{registration.phone || (isSw ? 'Hakuna simu ya biashara' : 'No business phone provided')}</p>
                        <p>{registration.address || (isSw ? 'Hakuna anwani' : 'No address provided')}</p>
                      </div>
                    </div>

                    {registration.approval_notes && (
                      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-600 dark:border-brand-700 dark:bg-brand-800/60 dark:text-brand-300">
                        <span className="font-semibold text-brand-900 dark:text-white">{isSw ? 'Maelezo:' : 'Notes:'}</span> {registration.approval_notes}
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[220px] flex-col gap-3">
                    {registration.approval_status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={activeId === registration.id}
                          onClick={() => handleDecision(registration, 'approve')}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-70"
                        >
                          <CheckCircleIcon className="h-5 w-5" />
                          {activeId === registration.id ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Kubali Usajili' : 'Approve Registration')}
                        </button>
                        <button
                          type="button"
                          disabled={activeId === registration.id}
                          onClick={() => handleDecision(registration, 'reject')}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-70"
                        >
                          <XCircleIcon className="h-5 w-5" />
                          {activeId === registration.id ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Kataa Usajili' : 'Reject Registration')}
                        </button>
                        <button
                          type="button"
                          disabled={activeId === registration.id}
                          onClick={() => handleDelete(registration)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger/30 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-70"
                        >
                          <TrashIcon className="h-5 w-5" />
                          {activeId === registration.id ? (isSw ? 'Inafuta...' : 'Deleting...') : (isSw ? 'Futa Usajili' : 'Delete Registration')}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-border bg-white/60 px-4 py-3 text-sm text-brand-600 dark:bg-brand-900/60 dark:text-brand-300">
                          <div className="flex items-center gap-2 font-semibold text-brand-900 dark:text-white">
                            <ClockIcon className="h-4 w-4 text-primary" />
                            {isSw ? 'Uamuzi umehifadhiwa' : 'Decision recorded'}
                          </div>
                          <p className="mt-2">{isSw ? 'Na:' : 'By:'} {registration.approved_by_email || (isSw ? 'Admin asiyejulikana' : 'Unknown admin')}</p>
                          <p>{registration.approved_at ? formatDate(registration.approved_at) : (isSw ? 'Hakuna tarehe' : 'No date recorded')}</p>
                        </div>

                        {registration.approval_status === 'approved' && registration.is_active && (
                          <button
                            type="button"
                            disabled={activeId === registration.id}
                            onClick={() => handleAccessAction(registration, 'restrict')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-warning px-4 py-2.5 text-sm font-semibold text-white hover:bg-warning/90 disabled:opacity-70"
                          >
                            <NoSymbolIcon className="h-5 w-5" />
                            {activeId === registration.id ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Zuia Ufikiaji' : 'Restrict Access')}
                          </button>
                        )}

                        {registration.approval_status === 'approved' && !registration.is_active && (
                          <button
                            type="button"
                            disabled={activeId === registration.id}
                            onClick={() => handleAccessAction(registration, 'restore')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-70"
                          >
                            <ArrowPathIcon className="h-5 w-5" />
                            {activeId === registration.id ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Rudisha Ufikiaji' : 'Restore Access')}
                          </button>
                        )}

                        {registration.approval_status === 'rejected' && (
                          <button
                            type="button"
                            disabled={activeId === registration.id}
                            onClick={() => handleDecision(registration, 'approve')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-70"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                            {activeId === registration.id ? (isSw ? 'Inahifadhi...' : 'Saving...') : (isSw ? 'Kubali Badala yake' : 'Approve Instead')}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={activeId === registration.id}
                          onClick={() => handleDelete(registration)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger/30 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-70"
                        >
                          <TrashIcon className="h-5 w-5" />
                          {activeId === registration.id ? (isSw ? 'Inafuta...' : 'Deleting...') : (isSw ? 'Futa Landlord' : 'Delete Landlord')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl dark:bg-brand-900">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-brand-900 dark:text-white">{isSw ? 'Tengeneza Mualiko wa Landlord' : 'Create Landlord Invite'}</h3>
                <p className="mt-1 text-sm text-brand-500">
                  {isSw
                    ? 'Tuma barua pepe salama ya mualiko wa usajili kwa mmiliki wa landlord. Kwenye development, kiungo cha moja kwa moja kinaonyeshwa hapa chini.'
                    : 'Send a secure invite-only registration email to the landlord owner. In development, the direct link is also shown below.'}
                </p>
              </div>
              <button onClick={closeInviteModal} className="rounded-full p-2 text-brand-400 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-800 dark:hover:text-white">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{isSw ? 'Barua Pepe ya Mmiliki' : 'Owner Email'}</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((current) => ({ ...current, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">{isSw ? 'Jina Kamili la Mmiliki' : 'Owner Full Name'}</label>
                <input
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm((current) => ({ ...current, full_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                />
              </div>

              {inviteLink && (
                <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
                  <p className="text-sm font-semibold text-success">{isSw ? 'Kiungo cha usajili (development)' : 'Development registration link'}</p>
                  <p className="mt-2 break-all text-sm text-brand-700 dark:text-brand-200">{inviteLink}</p>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:bg-success/90"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    {isSw ? 'Nakili Kiungo' : 'Copy Link'}
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeInviteModal}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-800"
                >
                  {isSw ? 'Funga' : 'Close'}
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {inviteSubmitting ? (isSw ? 'Inatuma...' : 'Sending...') : (isSw ? 'Tuma Barua ya Mualiko' : 'Send Invitation Email')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
