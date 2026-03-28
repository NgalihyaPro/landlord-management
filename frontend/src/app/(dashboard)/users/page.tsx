import { useEffect, useState } from 'react';
import api, { cachedGet, getApiErrorMessage, invalidateGetCache } from '@/lib/api';
import { ShieldCheckIcon, PlusIcon, XMarkIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import type { RoleOption, StaffUser } from '@/types/user';

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role_id: '2',
  });
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    phone: '',
    role_id: '2',
    is_active: true,
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [usersData, rolesData] = await Promise.all([
          cachedGet<StaffUser[]>('/users'),
          cachedGet<RoleOption[]>('/users/roles'),
        ]);
        setUsers(usersData);
        setRoles(rolesData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      role_id: roles.find((role) => role.name === 'manager')?.id?.toString() || '2',
    });
  };

  const openInviteModal = () => {
    setInviteLink('');
    resetForm();
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setSubmitting(false);
  };

  const openEditModal = (user: StaffUser) => {
    const matchedRole = roles.find((role) => role.name === user.role);
    setEditingUser(user);
    setEditFormData({
      full_name: user.full_name,
      phone: user.phone || '',
      role_id: String(matchedRole?.id || 2),
      is_active: user.is_active,
    });
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setSubmitting(false);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data } = await api.post('/users/invite', {
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        role_id: Number(formData.role_id),
      });
      invalidateGetCache('/users');
      setInviteLink(data.setup_link || '');
      const refreshedUsers = await cachedGet<StaffUser[]>('/users', { force: true });
      setUsers(refreshedUsers);
      toast.success(data.setup_link ? 'Staff invitation email sent. Development link is available below.' : 'Staff invitation email sent successfully.');
      resetForm();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to create invitation'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);

    try {
      await api.put(`/users/${editingUser.id}`, {
        full_name: editFormData.full_name.trim(),
        phone: editFormData.phone.trim(),
        role_id: Number(editFormData.role_id),
        is_active: editFormData.is_active,
      });

      invalidateGetCache('/users');
      const refreshedUsers = await cachedGet<StaffUser[]>('/users', { force: true });
      setUsers(refreshedUsers);
      toast.success('User access updated successfully');
      closeEditModal();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Failed to update user access'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Invitation link copied');
    } catch {
      toast.error('Failed to copy invitation link');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-brand-900 dark:text-white">Staff Management</h2>
          <p className="text-brand-500">Invite staff members, control roles, and monitor account setup status</p>
        </div>
        <button
          onClick={openInviteModal}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <PlusIcon className="h-5 w-5" />
          Invite Staff
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-brand-50/50 dark:bg-brand-800/50 border-b border-border/50 text-xs uppercase tracking-wider text-brand-500">
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Contact Info</th>
                <th className="px-6 py-4 font-semibold">Access Role</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold">Last Activity</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-brand-700 dark:text-brand-300 divide-y divide-border/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-brand-50/50 dark:hover:bg-brand-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {u.full_name.charAt(0)}
                      </div>
                      <span className="font-bold text-brand-900 dark:text-white">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium">{u.email}</p>
                    <p className="text-xs text-brand-500 mt-0.5">{u.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheckIcon className={`h-4 w-4 ${u.role === 'admin' ? 'text-primary' : 'text-brand-400'}`} />
                      <span className={`font-semibold capitalize ${u.role === 'admin' ? 'text-primary' : ''}`}>
                        {u.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      u.invitation_pending
                        ? 'bg-warning/10 text-warning border-warning/20'
                        : u.is_active
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-brand-100 text-brand-500 border-border'
                    }`}>
                      {u.invitation_pending ? 'Invite Pending' : u.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.invitation_pending ? (
                      <div>
                        <p className="font-medium text-brand-900 dark:text-white">Invite expires {u.invite_expires_at ? formatDate(u.invite_expires_at) : 'soon'}</p>
                        <p className="text-xs text-brand-500">Waiting for password setup</p>
                      </div>
                    ) : u.last_login ? (
                      <div>
                        <p className="font-medium text-brand-900 dark:text-white">{formatDate(u.last_login)}</p>
                        <p className="text-xs text-brand-500">Last login</p>
                      </div>
                    ) : (
                      <span className="text-xs text-brand-500">No login yet</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {u.invitation_pending ? (
                      <span className="text-xs font-semibold text-warning">Awaiting activation</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="text-primary hover:text-primary/70 font-semibold text-sm transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Edit Access
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl dark:bg-brand-900">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-brand-900 dark:text-white">Invite Staff Member</h3>
                <p className="mt-1 text-sm text-brand-500">Send a secure setup email instead of setting a password manually. In development, the direct setup link is also shown below.</p>
              </div>
              <button onClick={closeInviteModal} className="rounded-full p-2 text-brand-400 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-800 dark:hover:text-white">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Full Name</label>
                <input
                  value={formData.full_name}
                  onChange={(e) => setFormData((current) => ({ ...current, full_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Phone Number</label>
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData((current) => ({ ...current, phone: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Role</label>
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData((current) => ({ ...current, role_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {inviteLink && (
                <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
                  <p className="text-sm font-semibold text-success">Development setup link</p>
                  <p className="mt-2 break-all text-sm text-brand-700 dark:text-brand-200">{inviteLink}</p>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:bg-success/90"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy Setup Link
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeInviteModal}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Sending invite...' : 'Send Invitation Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl dark:bg-brand-900">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-brand-900 dark:text-white">Edit User Access</h3>
                <p className="mt-1 text-sm text-brand-500">Update the staff role and whether this account can sign in.</p>
              </div>
              <button onClick={closeEditModal} className="rounded-full p-2 text-brand-400 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-800 dark:hover:text-white">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Full Name</label>
                <input
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData((current) => ({ ...current, full_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Phone Number</label>
                <input
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData((current) => ({ ...current, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-500">Role</label>
                <select
                  value={editFormData.role_id}
                  onChange={(e) => setEditFormData((current) => ({ ...current, role_id: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-brand-700 dark:bg-brand-950 dark:text-white"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm dark:border-brand-700 dark:bg-brand-950">
                <input
                  type="checkbox"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData((current) => ({ ...current, is_active: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-brand-300 text-primary focus:ring-primary"
                />
                <span>
                  <span className="block font-semibold text-brand-900 dark:text-white">Allow sign in</span>
                  <span className="block text-brand-500">Turn this off to disable the account without deleting the staff member.</span>
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
