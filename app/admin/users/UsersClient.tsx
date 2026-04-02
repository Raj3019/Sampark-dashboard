'use client';

import { useState, useEffect, useCallback } from 'react';

type User = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: 'admin' | 'leader' | 'kk';
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

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', role: 'kk' as 'admin' | 'leader' | 'kk' });
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
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="kk">KK</option>
              <option value="leader">Leader</option>
              <option value="admin">Admin</option>
            </select>
          </div>

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

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json() as User[];
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as User['role'] } : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating role');
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting user');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
          <p className="text-slate-500 text-sm mt-1">Create and manage user accounts and roles</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New User
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Username</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Joined</th>
                <th className="text-right px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-3 text-slate-200 font-medium">{user.name}</td>
                  <td className="px-5 py-3 text-slate-400">@{user.username ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-400">{user.email}</td>
                  <td className="px-5 py-3">
                    <select
                      value={user.role}
                      disabled={updatingId === user.id}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className={`border rounded-full px-2 py-0.5 text-xs font-medium focus:outline-none ${ROLE_COLORS[user.role]} bg-transparent disabled:opacity-60`}
                    >
                      <option value="kk">KK</option>
                      <option value="leader">Leader</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={deletingId === user.id}
                      className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === user.id ? '...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchUsers}
        />
      )}
    </div>
  );
}
