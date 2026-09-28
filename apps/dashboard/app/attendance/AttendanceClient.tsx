'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { SABHA_TYPES, SABHA_DISPLAY } from '@/lib/sabha';

type SessionRow = {
  id: string;
  sabhaType: string;
  sessionDate: string;
  vakta: string | null;
  topic: string | null;
  presentCount: number;
  totalCount: number;
};

type MarkRow = {
  memberId: string;
  fullName: string;
  area: string | null;
  std: string | null;
  present: boolean;
  visited?: { sabhaType: string; sessionDate: string } | null;
  transferredOut?: boolean;
};

const ACCENT_CHIP: Record<string, string> = {
  blue: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
  purple: 'border-purple-500/40 bg-purple-500/15 text-purple-300',
  orange: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
};

const ACCENT_TEXT: Record<string, string> = {
  blue: 'text-blue-300',
  purple: 'text-purple-300',
  orange: 'text-orange-300',
};

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500';

function todayIso() {
  return new Date().toLocaleDateString('en-CA');
}

function formatDate(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// "Visited <sabha> on DD/MM/YYYY" for ISO session dates
function visitedLabel(visited: { sabhaType: string; sessionDate: string }) {
  const [yyyy, mm, dd] = visited.sessionDate.split('-');
  const dateText = visited.sessionDate && !Number.isNaN(Date.parse(visited.sessionDate)) ? `${dd}/${mm}/${yyyy}` : visited.sessionDate;
  return `Visited ${visited.sabhaType} on ${dateText}`;
}

function NewSessionModal({
  sabhaType,
  onClose,
  onCreated,
}: {
  sabhaType: string;
  onClose: () => void;
  onCreated: (session: SessionRow) => void;
}) {
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [vakta, setVakta] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sabhaType,
          sessionDate,
          vakta: vakta.trim() || null,
          topic: topic.trim() || null,
        }),
      });
      const data = await res.json() as { error?: string; existing?: boolean; session?: SessionRow };
      if (!res.ok) throw new Error(data.error ?? 'Failed to create session');
      if (data.existing) toast.info('A session for this date already exists — opening it');
      else toast.success('Session created');
      if (data.session) onCreated(data.session);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-slate-100 font-semibold text-lg">New Session</h2>
            <p className="mt-1 text-xs text-slate-500">{SABHA_DISPLAY[sabhaType]?.fullLabel ?? sabhaType}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">Session Date *</label>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">Vakta <span className="text-slate-600">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. Jatin Patel"
              value={vakta}
              onChange={(e) => setVakta(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-medium mb-1">Topic <span className="text-slate-600">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. Bhakti ni aavdal"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={inputClass}
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
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AttendanceClient() {
  const [sabha, setSabha] = useState<string>(SABHA_TYPES[0]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [vaktaDraft, setVaktaDraft] = useState('');
  const [topicDraft, setTopicDraft] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const fetchSessions = useCallback(async (type: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/attendance/sessions?sabha=${encodeURIComponent(type)}`);
      const data = await res.json() as { error?: string } | SessionRow[];
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to load sessions');
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(sabha); }, [sabha, fetchSessions]);

  const openMarks = useCallback(async (session: SessionRow) => {
    setActiveSession(session);
    setVaktaDraft(session.vakta ?? '');
    setTopicDraft(session.topic ?? '');
    setMarksLoading(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${session.id}/marks`);
      const data = await res.json() as { error?: string } | MarkRow[];
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Failed to load roster');
      setMarks(Array.isArray(data) ? data : []);
    } catch (err) {
      setActiveSession(null);
      toast.error(err instanceof Error ? err.message : 'Failed to load roster');
    } finally {
      setMarksLoading(false);
    }
  }, []);

  const presentCount = useMemo(() => marks.filter((mark) => mark.present).length, [marks]);

  const handleSaveMeta = async () => {
    if (!activeSession) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/attendance/sessions/${activeSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vakta: vaktaDraft.trim() || null, topic: topicDraft.trim() || null }),
      });
      const data = await res.json() as { error?: string; session?: SessionRow };
      if (!res.ok) throw new Error(data.error ?? 'Failed to save session details');
      if (data.session) {
        setActiveSession(data.session);
        setSessions((prev) => prev.map((s) => (s.id === data.session!.id ? data.session! : s)));
      }
      toast.success('Session details saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save session details');
    } finally {
      setSavingMeta(false);
    }
  };

  const backToList = () => {
    setActiveSession(null);
    setMarks([]);
    fetchSessions(sabha);
  };

  const accent = SABHA_DISPLAY[sabha]?.accent ?? 'orange';

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700 bg-linear-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-4 sm:px-5 sm:py-5 shadow-[0_10px_30px_rgba(2,6,23,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Attendance</h1>
            <p className="mt-1 text-sm text-slate-500">Mark weekly sabha attendance by session</p>
          </div>
          {!activeSession && (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full sm:w-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              + New Session
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {SABHA_TYPES.map((type) => {
            const display = SABHA_DISPLAY[type];
            const isActive = sabha === type;
            return (
              <button
                key={type}
                onClick={() => {
                  setSabha(type);
                  setActiveSession(null);
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? ACCENT_CHIP[display?.accent ?? 'blue']
                    : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                {isActive ? <CheckCircle className="h-4 w-4" /> : null}
                {display?.shortLabel ?? type}
                <span className="text-[10px] uppercase tracking-wide opacity-70">{display?.fullLabel ?? type}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeSession ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-4 sm:px-5 shadow-[0_10px_30px_rgba(2,6,23,0.18)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={backToList}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Sessions
                </button>
                <div>
                  <p className={`text-lg font-bold ${ACCENT_TEXT[accent]}`}>{formatDate(activeSession.sessionDate)}</p>
                  <p className="text-xs text-slate-500">{SABHA_DISPLAY[sabha]?.fullLabel ?? sabha}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-center">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Marked present</p>
                  <p className="mt-1 text-xl font-bold text-green-400">{presentCount} / {marks.length}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div>
                <label className="block text-slate-500 text-[11px] font-medium uppercase tracking-wide mb-1">Date</label>
                <p className="px-3 py-2 text-sm text-slate-300">{formatDate(activeSession.sessionDate)}</p>
              </div>
              <div>
                <label className="block text-slate-500 text-[11px] font-medium uppercase tracking-wide mb-1">Vakta</label>
                <input
                  type="text"
                  placeholder="Vakta name"
                  value={vaktaDraft}
                  onChange={(e) => setVaktaDraft(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-slate-500 text-[11px] font-medium uppercase tracking-wide mb-1">Topic</label>
                <input
                  type="text"
                  placeholder="Session topic"
                  value={topicDraft}
                  onChange={(e) => setTopicDraft(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSaveMeta}
                  disabled={savingMeta}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                >
                  {savingMeta ? 'Saving...' : 'Save Details'}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-[0_10px_30px_rgba(2,6,23,0.18)]">
            <div className="overflow-x-auto">
              <table style={{ minWidth: 720 }} className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700">
                  <tr>
                    {['Name', 'Area', 'Std', 'Status'].map((heading, index) => (
                      <th key={heading} className={`px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider ${index === 3 ? 'text-right' : 'text-left'}`}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {marksLoading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center">
                        <div className="mx-auto w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      </td>
                    </tr>
                  ) : marks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                        No attending members in this sabha yet. Add members in Member Management.
                      </td>
                    </tr>
                  ) : (
                    marks.map((mark) => (
                      <tr key={mark.memberId} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-3.5 text-slate-100 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{mark.fullName}</span>
                            {mark.transferredOut && (
                              <span
                                title="Transferred out — restored automatically when they reappear"
                                className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
                              >
                                Transferred
                              </span>
                            )}
                          </div>
                          {mark.present && mark.visited && (
                            <p className="mt-0.5 text-[11px] font-normal text-slate-500">{visitedLabel(mark.visited)}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">{mark.area ?? '—'}</td>
                        <td className="px-5 py-3.5 text-slate-400">{mark.std ?? '—'}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                mark.present
                                  ? 'border-green-500/40 bg-green-500/15 text-green-300'
                                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400/80'
                              }`}
                            >
                              {mark.present ? 'Present' : 'Absent'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-[0_10px_30px_rgba(2,6,23,0.18)]">
          <div className="overflow-x-auto">
            <table style={{ minWidth: 760 }} className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700">
                <tr>
                  {['Date', 'Vakta', 'Topic', 'Present', 'Actions'].map((heading, index) => (
                    <th key={heading} className={`px-5 py-3 text-slate-400 text-xs font-semibold uppercase tracking-wider ${index === 4 ? 'text-right' : 'text-left'}`}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4 text-slate-100 font-medium">{formatDate(session.sessionDate)}</td>
                    <td className="px-5 py-4 text-slate-400">{session.vakta ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-400">{session.topic ?? '—'}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-green-400 font-semibold">{session.presentCount}</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-slate-400">{session.totalCount}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => openMarks(session)}
                        className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-orange-300 transition-colors hover:bg-orange-500/10 hover:text-orange-200"
                      >
                        Marks
                      </button>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      No sessions yet for {SABHA_DISPLAY[sabha]?.fullLabel ?? sabha}. Create one to start marking attendance.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <NewSessionModal
          sabhaType={sabha}
          onClose={() => setShowCreate(false)}
          onCreated={(session) => {
            fetchSessions(sabha);
            openMarks(session);
          }}
        />
      )}
    </div>
  );
}
