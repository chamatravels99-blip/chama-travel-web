'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, UserPlus, Users } from 'lucide-react';

type AppRole = 'super_admin' | 'admin';
type AccountStatus = 'active' | 'inactive';
type UserRecord = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  account_status: AccountStatus;
  created_at: string;
  roles: AppRole[];
  legacy_roles: string[];
};

const PAGE_SIZE = 50;
const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [actorRoles, setActorRoles] = useState<AppRole[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Record<string, AppRole>>({});
  const [busyUserId, setBusyUserId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [creating, setCreating] = useState(false);

  const isSuperAdmin = actorRoles.includes('super_admin');
  const canCreateStaff = isSuperAdmin;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);
      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' });
      const result = await response.json() as {
        success?: boolean;
        error?: string;
        data?: UserRecord[];
        total_count?: number;
        actor_roles?: AppRole[];
      };
      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.error || 'User data could not be loaded.');
      }
      setUsers(result.data);
      setActorRoles(result.actor_roles ?? []);
      setTotalCount(result.total_count ?? 0);
      setSelectedRoles((current) => {
        const next = { ...current };
        for (const user of result.data ?? []) {
          if (!next[user.id] && user.roles.length) next[user.id] = user.roles[0];
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'User data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search, statusFilter]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  async function updateUser(userId: string, body: Record<string, string>) {
    setBusyUserId(userId);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...body }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'User could not be updated.');
      setNotice('User updated.');
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'User could not be updated.');
    } finally {
      setBusyUserId('');
    }
  }

  async function createStaffAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setNotice('');
    setError('');
    try {
        const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newUser, role: 'admin' }),
      });
      const result = await response.json() as { success?: boolean; error?: string; message?: string };
      if (!response.ok || !result.success) throw new Error(result.error || 'Admin account could not be created.');
      setNotice(result.message || 'Admin account created.');
      setNewUser({ full_name: '', email: '', phone: '', password: '' });
      setShowCreateForm(false);
      setPage(1);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Admin account could not be created.');
    } finally {
      setCreating(false);
    }
  }

  function canManageUser(user: UserRecord) {
    if (user.roles.includes('super_admin')) return false;
    return isSuperAdmin || (user.legacy_roles.length === 0 && !user.roles.includes('admin'));
  }

  const roleOptions: AppRole[] = isSuperAdmin ? ['admin'] : [];

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-700">
            <ShieldCheck className="h-4 w-4" /> Account administration
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Manage accounts without deleting their business history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          {canCreateStaff && (
            <button
              type="button"
              onClick={() => setShowCreateForm((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800"
            >
              <UserPlus className="h-4 w-4" /> Create staff account
            </button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

      {showCreateForm && canCreateStaff && (
        <form onSubmit={createStaffAccount} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <h2 className="font-extrabold text-slate-900">Create staff account</h2>
            <p className="mt-1 text-xs text-slate-500">
              Existing email addresses are not duplicated. Only a Super Admin can create an Admin account.
            </p>
          </div>
          <label className="text-xs font-bold text-slate-700">
            Application role
            <input value="Admin" readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-normal" />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Full name
            <input required minLength={2} maxLength={120} value={newUser.full_name} onChange={(event) => setNewUser({ ...newUser, full_name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Email address
            <input required type="email" maxLength={254} value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Phone (optional)
            <input type="tel" value={newUser.phone} onChange={(event) => setNewUser({ ...newUser, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" />
          </label>
          <label className="text-xs font-bold text-slate-700">
            Temporary password
            <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal" />
          </label>
          <div className="flex items-center gap-2 md:col-span-2">
            <button disabled={creating} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              {creating ? 'Creating…' : 'Create Admin'}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]"
        >
          <label className="relative block">
            <span className="sr-only">Search users by name, email or phone</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name, email or phone" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            <span className="sr-only">Filter by role</span>
            <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal">
              <option value="">All roles</option>
              {Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            <span className="sr-only">Filter by account status</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800">Search</button>
        </form>

        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> {totalCount} account(s)</span>
          <span>Page {page} of {pageCount}</span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading user accounts…</p>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No accounts match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const manageable = canManageUser(user);
                  const hasPrivilegedRole = user.roles.includes('admin') || user.legacy_roles.length > 0;
                  const canChange = manageable && isSuperAdmin && !user.legacy_roles.includes('driver') && user.account_status === 'active';
                  const roleValue = selectedRoles[user.id] ?? user.roles[0] ?? 'admin';
                  return (
                    <tr key={user.id} className="align-top hover:bg-slate-50/70">
                      <td className="max-w-72 px-4 py-4">
                        <button type="button" onClick={() => setSelectedUserId(selectedUserId === user.id ? '' : user.id)} className="text-left font-bold text-slate-900 hover:text-blue-700">
                          {user.full_name}
                        </button>
                        <p className="mt-0.5 break-all text-xs text-slate-500">{user.email}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{user.phone || 'No phone provided'}</p>
                        {selectedUserId === user.id && (
                          <div className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-700">
                            <p><b>User ID:</b> {user.id}</p>
                            <p className="mt-1"><b>Created:</b> {new Date(user.created_at).toLocaleString()}</p>
                            <p className="mt-1"><b>Email:</b> {user.email}</p>
                            <p className="mt-1"><b>Phone:</b> {user.phone || 'Not provided'}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex max-w-48 flex-wrap gap-1">
                          {user.roles.length
                            ? user.roles.map((role) => <span key={role} className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800">{ROLE_LABELS[role]}</span>)
                            : <span className="text-xs text-slate-400">No active Admin role</span>}
                          {user.legacy_roles.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{role === 'driver' ? 'Internal driver record' : `Legacy ${role}`}</span>)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${user.account_status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {user.account_status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">{new Date(user.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        {manageable ? (
                          <div className="flex min-w-48 flex-col gap-2">
                            {canChange && (
                              <div className="flex gap-1">
                                <select
                                  aria-label={`Role for ${user.full_name}`}
                                  value={roleValue}
                                  onChange={(event) => setSelectedRoles({ ...selectedRoles, [user.id]: event.target.value as AppRole })}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2 text-xs"
                                >
                                  {roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                                </select>
                                <button
                                  type="button"
                                  disabled={busyUserId === user.id}
                                  onClick={() => void updateUser(user.id, { action: 'change_role', role: roleValue })}
                                  className="rounded-lg bg-blue-700 px-2.5 py-2 text-[10px] font-bold text-white disabled:opacity-50"
                                >
                                  Set role
                                </button>
                              </div>
                            )}
                            {(isSuperAdmin || !hasPrivilegedRole) && (
                              <button
                                type="button"
                                disabled={busyUserId === user.id}
                                onClick={() => void updateUser(user.id, {
                                  action: 'set_status',
                                  account_status: user.account_status === 'active' ? 'inactive' : 'active',
                                })}
                                className={`rounded-lg px-2.5 py-2 text-[10px] font-bold disabled:opacity-50 ${user.account_status === 'active' ? 'bg-amber-50 text-amber-800 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}
                              >
                                {user.account_status === 'active' ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                            {!canChange && (hasPrivilegedRole || user.legacy_roles.length > 0) && !isSuperAdmin && <span className="text-xs text-slate-400">Super Admin management only</span>}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Protected account</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">{users.length ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + users.length} of ${totalCount}` : 'No results'}</span>
          <button
            type="button"
            disabled={page >= pageCount || users.length < PAGE_SIZE || loading}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </footer>
      </section>

      {selectedUser && <span className="sr-only">Showing details for {selectedUser.full_name}</span>}
    </main>
  );
}
