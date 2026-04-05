'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

type User = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: 'admin' | 'leader' | 'kk';
  assignedKK: string | null;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  leader: 'Leader',
  kk: 'KK',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/15 text-red-300 border-red-500/30',
  leader: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  kk: 'bg-green-500/15 text-green-300 border-green-500/30',
};

function CreateUserModal({
  onClose,
  onCreated,
  kkOptions,
}: {
  onClose: () => void;
  onCreated: () => void;
  kkOptions: string[];
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'kk' as 'admin' | 'leader' | 'kk',
    assignedKK: kkOptions[0] ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to create user');
      toast.success('User created successfully');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      toast.error(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-slate-100 font-semibold text-lg">Create New User</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Full Name', key: 'name', type: 'text', placeholder: 'e.g. Jay Shah' },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'e.g. jay@example.com' },
            { label: 'Username', key: 'username', type: 'text', placeholder: 'e.g. jayshah' },
            { label: 'Password', key: 'password', type: 'password', placeholder: 'Min 8 characters' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-slate-400 text-xs font-medium mb-1">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                required
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'leader' | 'kk' }))}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="kk">KK</option>
              <option value="leader">Leader</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {form.role === 'kk' && (
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">Assigned KK Name</label>
              <select
                required
                value={form.assignedKK}
                onChange={(e) => setForm((f) => ({ ...f, assignedKK: e.target.value }))}
                style={{ colorScheme: 'dark' }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
              >
                {kkOptions.length === 0 ? (
                  <option value="">No KK names found</option>
                ) : (
                  kkOptions.map((kk) => (
                    <option key={kk} value={kk}>{kk}</option>
                  ))
                )}
              </select>
              {kkOptions.length === 0 && (
                <p className="text-amber-400 text-[11px] mt-1">No KK names found in current sheet data.</p>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [kkOptions, setKkOptions] = useState<string[]>([]);
  const [kkOptionsLoading, setKkOptionsLoading] = useState(true);
  const [savedAssignedById, setSavedAssignedById] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | User['role']>('all');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json() as User[];
      setUsers(data);
      setSavedAssignedById(
        data.reduce<Record<string, string>>((acc, user) => {
          acc[user.id] = (user.assignedKK ?? '').trim();
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const fetchKkOptions = async () => {
      try {
        const res = await fetch('/api/admin/kk-names');
        if (!res.ok) throw new Error('Failed to load KK options');
        const data = await res.json() as { kkNames?: string[] };
        setKkOptions(Array.isArray(data.kkNames) ? data.kkNames : []);
      } catch {
        setKkOptions([]);
        toast.error('Failed to load KK names');
      } finally {
        setKkOptionsLoading(false);
      }
    };

    fetchKkOptions();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      if (!matchesRole) return false;
      if (!query) return true;

      return [user.name, user.email, user.username ?? '', user.assignedKK ?? '', user.role]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    kk: users.filter((user) => user.role === 'kk').length,
    leader: users.filter((user) => user.role === 'leader').length,
    admin: users.filter((user) => user.role === 'admin').length,
  }), [users]);

  const initialLoading = loading || kkOptionsLoading;

  const handleRoleChange = async (user: User, newRole: string) => {
    const nextAssignedKK = newRole === 'kk'
      ? (user.assignedKK?.trim() || kkOptions[0] || '')
      : '';
    if (newRole === 'kk' && !nextAssignedKK) {
      toast.error('No KK options available. Please check sheet data and reload.');
      return;
    }

    const userId = user.id;
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole,
          assignedKK: newRole === 'kk' ? nextAssignedKK : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      setUsers((prev) => prev.map((u) => u.id === userId
        ? { ...u, role: newRole as User['role'], assignedKK: newRole === 'kk' ? nextAssignedKK : null }
        : u
      ));
      setSavedAssignedById((prev) => ({
        ...prev,
        [userId]: newRole === 'kk' ? nextAssignedKK : '',
      }));
      toast.success('Role updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error updating role');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignedKkSave = async (user: User) => {
    if (user.role !== 'kk') return;
    const assignedKK = user.assignedKK?.trim() ?? '';
    if (!assignedKK) {
      toast.error('Assigned KK name is required for KK users.');
      return;
    }

    setUpdatingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: user.role, assignedKK }),
      });
      if (!res.ok) throw new Error('Failed to update assigned KK');
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, assignedKK } : u)));
      setSavedAssignedById((prev) => ({ ...prev, [user.id]: assignedKK }));
      toast.success('Assigned KK saved successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error updating assigned KK');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete user');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSavedAssignedById((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      toast.success('User deleted successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error deleting user');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-linear-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_10px_30px_rgba(2,6,23,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
            <p className="mt-1 text-sm text-slate-500">Create and manage user accounts and roles</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="w-full sm:w-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New User
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Total Users', value: stats.total, accent: 'orange' },
            { label: 'KK Users', value: stats.kk, accent: 'green' },
            { label: 'Leaders', value: stats.leader, accent: 'blue' },
            { label: 'Admins', value: stats.admin, accent: 'red' },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
              <p className={`mt-2 text-2xl font-bold ${card.accent === 'green' ? 'text-green-400' : card.accent === 'blue' ? 'text-blue-400' : card.accent === 'red' ? 'text-red-400' : 'text-orange-400'}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:flex lg:flex-1 lg:items-center lg:max-w-2xl">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, email, KK..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | User['role'])}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="kk">KK</option>
              <option value="leader">Leader</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="text-xs text-slate-500">
            Showing <span className="text-slate-300 font-medium">{filteredUsers.length}</span> of <span className="text-slate-300 font-medium">{users.length}</span>
          </div>
        </div>
      </div>

      {initialLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-[0_10px_30px_rgba(2,6,23,0.18)]">
          <div className="overflow-x-auto">
            <table style={{ minWidth: 1040 }} className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700">
                <tr>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Username</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Email</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Assigned KK</th>
                  <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Joined</th>
                  <th className="text-right px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4 text-slate-100 font-medium">{user.name}</td>
                    <td className="px-5 py-4 text-slate-400">@{user.username ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-400">{user.email}</td>
                    <td className="px-5 py-4">
                      <select
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium focus:outline-none ${ROLE_COLORS[user.role]} bg-slate-900/90 text-slate-100 disabled:opacity-60`}
                      >
                        <option value="kk">KK</option>
                        <option value="leader">Leader</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      {user.role === 'kk' ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={user.assignedKK ?? ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, assignedKK: value } : u)));
                            }}
                            style={{ colorScheme: 'dark' }}
                            className="w-48 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:border-orange-500 focus:outline-none"
                          >
                            {kkOptions.length === 0 ? (
                              <option value="">No KK names found</option>
                            ) : (
                              kkOptions.map((kk) => (
                                <option key={kk} value={kk}>{kk}</option>
                              ))
                            )}
                          </select>
                          <button
                            onClick={() => handleAssignedKkSave(user)}
                            disabled={
                              updatingId === user.id
                              || (user.assignedKK ?? '').trim().length === 0
                              || (user.assignedKK ?? '').trim() === (savedAssignedById[user.id] ?? '')
                            }
                            className="inline-flex items-center rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        disabled={deletingId === user.id}
                        className="inline-flex items-center rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingId === user.id ? '...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      No users match your search or role filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchUsers}
          kkOptions={kkOptions}
        />
      )}
    </div>
  );
}
