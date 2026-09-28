'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { SABHA_TYPES, SABHA_DISPLAY } from '@/lib/sabha';

type Member = {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  area: string | null;
  std: string | null;
  sabhaType: string;
  followUpMemberId: string | null;
  followUpKk: string | null;
  isKk: boolean;
  attending: boolean;
  superActive: boolean;
  notes: string | null;
  attendanceCount: number;
  transferredOut: boolean;
  transferredOutOn: string | null;
  createdAt: string;
  updatedAt: string;
};

const ACCENT_BADGE: Record<string, string> = {
  blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  orange: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
};

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500';

function MemberModal({
  member,
  onClose,
  onSaved,
}: {
  member: Member | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: member?.fullName ?? '',
    sabhaType: member?.sabhaType ?? SABHA_TYPES[0],
    phoneNumber: member?.phoneNumber ?? '',
    area: member?.area ?? '',
    std: member?.std ?? '',
    dateOfBirth: member?.dateOfBirth ?? '',
    followUpMemberId: member?.followUpMemberId ?? '',
    attending: member?.attending ?? true,
    superActive: member?.superActive ?? false,
    isKk: member?.isKk ?? false,
    notes: member?.notes ?? '',
  });
  const [kkOptions, setKkOptions] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchKkOptions = async () => {
      try {
        const res = await fetch('/api/admin/members');
        if (!res.ok) throw new Error('Failed to load KK options');
        const data = await res.json() as Member[];
        setKkOptions(data.filter((m) => m.isKk && m.id !== member?.id));
      } catch {
        setKkOptions([]);
        toast.error('Failed to load KK options');
      }
    };

    fetchKkOptions();
  }, [member?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      fullName: form.fullName.trim(),
      sabhaType: form.sabhaType,
      phoneNumber: form.phoneNumber.trim() || null,
      area: form.area.trim() || null,
      std: form.std.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      followUpMemberId: form.followUpMemberId || null,
      attending: form.attending,
      superActive: form.superActive,
      isKk: form.isKk,
      notes: form.notes.trim() || null,
    };

    try {
      const res = await fetch(member ? `/api/admin/members/${member.id}` : '/api/admin/members', {
        method: member ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to save member');
      toast.success(member ? 'Member updated successfully' : 'Member created successfully');
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save member';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto py-8">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-slate-100 font-semibold text-lg">{member ? 'Edit Member' : 'New Member'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Jay Shah"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">Sabha *</label>
              <select
                required
                value={form.sabhaType}
                onChange={(e) => setForm((f) => ({ ...f, sabhaType: e.target.value }))}
                style={{ colorScheme: 'dark' }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
              >
                {SABHA_TYPES.map((type) => (
                  <option key={type} value={type}>{SABHA_DISPLAY[type]?.fullLabel ?? type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">Std</label>
              <input
                type="text"
                placeholder="e.g. 10"
                value={form.std}
                onChange={(e) => setForm((f) => ({ ...f, std: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">Phone</label>
              <input
                type="text"
                placeholder="e.g. +91 98765 43210"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">Area</label>
              <input
                type="text"
                placeholder="e.g. Vastrapur"
                value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">Date of Birth</label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              style={{ colorScheme: 'dark' }}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">
              Follow-Up KK <span className="text-slate-600">(optional)</span>
            </label>
            <select
              value={form.followUpMemberId}
              onChange={(e) => setForm((f) => ({ ...f, followUpMemberId: e.target.value }))}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="">None</option>
              {kkOptions.map((kk) => (
                <option key={kk.id} value={kk.id}>
                  {kk.fullName}{SABHA_DISPLAY[kk.sabhaType] ? ` (${SABHA_DISPLAY[kk.sabhaType].shortLabel})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              { key: 'attending', label: 'Attending' },
              { key: 'superActive', label: 'Super Active' },
              { key: 'isKk', label: 'Is KK' },
            ] as const).map((toggle) => (
              <label key={toggle.key} className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 cursor-pointer">
                <span className="text-slate-300 text-xs font-medium">{toggle.label}</span>
                <input
                  type="checkbox"
                  checked={form[toggle.key]}
                  onChange={(e) => setForm((f) => ({ ...f, [toggle.key]: e.target.checked }))}
                  className="h-4 w-4 accent-orange-500"
                />
              </label>
            ))}
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">Notes</label>
            <textarea
              rows={3}
              placeholder="Any follow-up context..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={`${inputClass} resize-none`}
            />
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
              {loading ? 'Saving...' : member ? 'Save Changes' : 'Create Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AttendingSwitch({ attending, disabled, onToggle }: { attending: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={attending ? 'Marked attending' : 'Marked not attending'}
      className={`relative h-5 w-10 rounded-full transition-colors disabled:opacity-50 ${attending ? 'bg-green-500' : 'bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${attending ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  );
}

export default function MembersClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sabhaFilter, setSabhaFilter] = useState<'all' | string>('all');
  const [attendingFilter, setAttendingFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [modalMember, setModalMember] = useState<Member | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/members');
      if (!res.ok) throw new Error('Failed to load members');
      const data = await res.json() as Member[];
      setMembers(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      if (sabhaFilter !== 'all' && member.sabhaType !== sabhaFilter) return false;
      if (attendingFilter === 'yes' && !member.attending) return false;
      if (attendingFilter === 'no' && member.attending) return false;
      if (!query) return true;

      return [member.fullName, member.phoneNumber ?? '', member.area ?? '', member.notes ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [members, search, sabhaFilter, attendingFilter]);

  const stats = useMemo(() => ({
    total: members.length,
    cn: members.filter((m) => m.sabhaType === 'Chirag Nagar').length,
    ayc: members.filter((m) => m.sabhaType === 'Chirag Nagar(Kishor)').length,
    bal: members.filter((m) => m.sabhaType === 'Bal Sabha').length,
    attending: members.filter((m) => m.attending).length,
    notAttending: members.filter((m) => !m.attending).length,
  }), [members]);

  const handleToggleAttending = async (member: Member) => {
    const next = !member.attending;
    setTogglingId(member.id);
    setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, attending: next } : m)));

    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attending: next }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to update attending');
      toast.success(`${member.fullName} marked ${next ? 'attending' : 'not attending'}`);
    } catch (err) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, attending: member.attending } : m)));
      toast.error(err instanceof Error ? err.message : 'Error updating attending');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (member: Member) => {
    if (!confirm(`Delete member "${member.fullName}"? Their attendance history will also be removed. This cannot be undone.`)) return;
    setDeletingId(member.id);
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, { method: 'DELETE' });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete member');
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success('Member deleted successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error deleting member');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-linear-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_10px_30px_rgba(2,6,23,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Member Management</h1>
            <p className="mt-1 text-sm text-slate-500">Roster of Yuvaks across all sabhas</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="w-full sm:w-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Member
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            { label: 'Total', value: stats.total, className: 'text-orange-400' },
            { label: 'Yuva CN', value: stats.cn, className: 'text-blue-400' },
            { label: 'AYC', value: stats.ayc, className: 'text-purple-400' },
            { label: 'Bal', value: stats.bal, className: 'text-orange-400' },
            { label: 'Attending', value: stats.attending, className: 'text-green-400' },
            { label: 'Not attending', value: stats.notAttending, className: 'text-red-400' },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
              <p className={`mt-2 text-2xl font-bold ${card.className}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px_130px] lg:flex lg:flex-1 lg:items-center lg:max-w-3xl">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, area, notes..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
            />
            <select
              value={sabhaFilter}
              onChange={(e) => setSabhaFilter(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Sabhas</option>
              {SABHA_TYPES.map((type) => (
                <option key={type} value={type}>{SABHA_DISPLAY[type]?.fullLabel ?? type}</option>
              ))}
            </select>
            <select
              value={attendingFilter}
              onChange={(e) => setAttendingFilter(e.target.value as 'all' | 'yes' | 'no')}
              style={{ colorScheme: 'dark' }}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="all">All Attending</option>
              <option value="yes">Attending: Yes</option>
              <option value="no">Attending: No</option>
            </select>
          </div>
          <div className="text-xs text-slate-500">
            Showing <span className="text-slate-300 font-medium">{filteredMembers.length}</span> of <span className="text-slate-300 font-medium">{members.length}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-[0_10px_30px_rgba(2,6,23,0.18)]">
          <div className="overflow-x-auto">
            <table style={{ minWidth: 1160 }} className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700">
                <tr>
                  {['Name', 'Sabha', 'Area', 'STD', 'Phone', 'Follow-Up KK', 'Attending', 'Super Active', 'Actions'].map((heading, index) => (
                    <th
                      key={heading}
                      className={`px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider ${index === 8 ? 'text-right' : 'text-left'}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4 text-slate-100 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{member.fullName}</span>
                        {member.isKk && (
                          <span className="rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-300">
                            KK
                          </span>
                        )}
                        {member.transferredOut && (
                          <span
                            title={member.transferredOutOn ? `Transferred out on ${member.transferredOutOn}` : 'Transferred out'}
                            className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
                          >
                            Transferred
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${ACCENT_BADGE[SABHA_DISPLAY[member.sabhaType]?.accent ?? 'blue']}`}>
                        {SABHA_DISPLAY[member.sabhaType]?.shortLabel ?? member.sabhaType}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{member.area ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-400">{member.std ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-400">{member.phoneNumber ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-400">{member.followUpKk ?? '—'}</td>
                    <td className="px-5 py-4">
                      <AttendingSwitch
                        attending={member.attending}
                        disabled={togglingId === member.id}
                        onToggle={() => handleToggleAttending(member)}
                      />
                    </td>
                    <td className="px-5 py-4">
                      {member.superActive ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">Super</span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setModalMember(member)}
                          className="inline-flex items-center rounded-md px-2 py-1 text-xs text-blue-300 transition-colors hover:bg-blue-500/10 hover:text-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(member)}
                          disabled={deletingId === member.id}
                          className="inline-flex items-center rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                        >
                          {deletingId === member.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                      {members.length === 0 ? 'No members yet. Create the first member to get started.' : 'No members match your search or filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(showCreate || modalMember) && (
        <MemberModal
          member={modalMember}
          onClose={() => {
            setShowCreate(false);
            setModalMember(null);
          }}
          onSaved={fetchMembers}
        />
      )}
    </div>
  );
}
