'use client';

import { ReactNode } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Loader2, Lock, UserRound, Users, XCircle } from 'lucide-react';
import ContactActions from '@/components/ContactActions';
import { PersonDetail } from '@/lib/peopleSearchTypes';

type DrawerState = {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: PersonDetail | null;
};

type PersonDetailDrawerProps = DrawerState & {
  onClose: () => void;
};

function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  return (
    <div className="rounded-xl border border-[#d9cdbb] bg-[#f1eadf] px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/70">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a97aa] dark:text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#1f3552] dark:text-slate-100">{value === true ? 'Yes' : value === false ? 'No' : value || 'Not available'}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: 'green' | 'yellow' | 'red' }) {
  const styles = {
    green: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    yellow: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300',
    red: 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300',
  };
  const labels = { green: 'Low Risk', yellow: 'Moderate Risk', red: 'High Risk' };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[risk]}`}>{labels[risk]}</span>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-[#1f3552] dark:text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

function AttendanceDots({ records }: { records: Array<{ date: string; present: boolean }> }) {
  if (records.length === 0) return <p className="text-sm text-[#64748b] dark:text-slate-400">No attendance records available.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {records.map((record) => (
        <span
          key={record.date}
          title={`${record.date}: ${record.present ? 'Present' : 'Absent'}`}
          className={`h-8 min-w-8 rounded-lg px-2 text-center text-[11px] font-semibold leading-8 ${
            record.present
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
              : 'bg-[#eadfce] text-[#64748b] dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {record.present ? 'P' : 'A'}
        </span>
      ))}
    </div>
  );
}

function RestrictedNotice({ reason }: { reason?: string }) {
  if (!reason) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{reason}</span>
    </div>
  );
}

function YuvakDetailView({ detail }: { detail: Extract<PersonDetail, { type: 'yuvak' }> }) {
  return (
    <div className="space-y-6">
      <RestrictedNotice reason={detail.visibility.restrictedReason} />
      <Section title="Personal Details">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Phone" value={detail.profile.phoneNumber} />
          <Field label="DOB" value={detail.profile.dob} />
          <Field label="Std" value={detail.profile.std} />
          <Field label="Area" value={detail.profile.area} />
          <Field label="Sabha" value={detail.profile.sabhaType} />
          <Field label="Attending" value={detail.profile.attendingSabha} />
        </div>
        <Field label="Follow-up KK" value={detail.profile.followUpKK} />
        {detail.profile.phoneNumber ? <ContactActions name={detail.profile.name} phoneNumber={detail.profile.phoneNumber} size="sm" /> : null}
      </Section>

      <Section title="Attendance Summary">
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Attended" value={detail.attendance.sabhasAttended} />
          <Field label="Total" value={detail.attendance.totalSabhas} />
          <Field label="Percent" value={`${detail.attendance.attendancePercent}%`} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge risk={detail.status.risk} />
          <span className="rounded-full border border-[#d9cdbb] bg-[#f1eadf] px-2.5 py-1 text-xs font-semibold text-[#64748b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {detail.status.superActive ? 'Super Active' : 'Needs Attention'}
          </span>
          <span className="rounded-full border border-[#d9cdbb] bg-[#f1eadf] px-2.5 py-1 text-xs font-semibold text-[#64748b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Last Sabha: {detail.attendance.lastSabhaPresent === null ? 'N/A' : detail.attendance.lastSabhaPresent ? 'Present' : 'Absent'}
          </span>
        </div>
      </Section>

      <Section title="Last 6 Sabhas">
        <AttendanceDots records={detail.attendance.last6} />
      </Section>

      <Section title="Full Attendance Record">
        <div className="max-h-64 overflow-y-auto rounded-xl border border-[#d9cdbb] bg-[#f1eadf] dark:border-slate-700 dark:bg-transparent">
          {detail.attendance.records.map((record) => (
            <div key={record.date} className="flex items-center justify-between border-b border-[#d8cdbd] px-3 py-2 last:border-b-0 dark:border-slate-800">
              <span className="text-sm text-[#334155] dark:text-slate-300">{record.date}</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${record.present ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
                {record.present ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {record.present ? 'Present' : 'Absent'}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function KkDetailView({ detail }: { detail: Extract<PersonDetail, { type: 'kk' }> }) {
  return (
    <div className="space-y-6">
      <RestrictedNotice reason={detail.visibility.restrictedReason} />
      <Section title="KK Profile">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Login User" value={detail.profile.user?.name} />
          <Field label="Username" value={detail.profile.user?.username} />
          <Field label="Email" value={detail.profile.user?.email} />
          <Field label="Created" value={detail.profile.user?.createdAt ? new Date(detail.profile.user.createdAt).toLocaleDateString() : null} />
        </div>
      </Section>

      <Section title="KK Attendance">
        {detail.selfAttendance ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Sabha" value={detail.selfAttendance.sabhaType} />
              <Field label="Area" value={detail.selfAttendance.area} />
              <Field label="Phone" value={detail.selfAttendance.phoneNumber} />
              <Field label="DOB" value={detail.selfAttendance.dob} />
              <Field label="Std" value={detail.selfAttendance.std} />
              <Field label="Percent" value={`${detail.selfAttendance.attendancePercent}%`} />
              <Field label="Attended" value={detail.selfAttendance.sabhasAttended} />
              <Field label="Total" value={detail.selfAttendance.totalSabhas} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge risk={detail.selfAttendance.risk} />
              <span className="rounded-full border border-[#d9cdbb] bg-[#f1eadf] px-2.5 py-1 text-xs font-semibold text-[#64748b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {detail.selfAttendance.superActive ? 'Super Active' : 'Needs Attention'}
              </span>
              <span className="rounded-full border border-[#d9cdbb] bg-[#f1eadf] px-2.5 py-1 text-xs font-semibold text-[#64748b] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Last Sabha: {detail.selfAttendance.lastSabhaPresent === null ? 'N/A' : detail.selfAttendance.lastSabhaPresent ? 'Present' : 'Absent'}
              </span>
            </div>
            <AttendanceDots records={detail.selfAttendance.last6} />
            <div className="max-h-52 overflow-y-auto rounded-xl border border-[#d9cdbb] bg-[#f1eadf] dark:border-slate-700 dark:bg-transparent">
              {detail.selfAttendance.records.map((record) => (
                <div key={record.date} className="flex items-center justify-between border-b border-[#d8cdbd] px-3 py-2 last:border-b-0 dark:border-slate-800">
                  <span className="text-sm text-[#334155] dark:text-slate-300">{record.date}</span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${record.present ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
                    {record.present ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {record.present ? 'Present' : 'Absent'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-[#d9cdbb] bg-[#f1eadf] px-3 py-3 text-sm text-[#64748b] dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
            No matching yuvak attendance row found for this KK name.
          </p>
        )}
      </Section>

      <Section title="Assignment Summary">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Assigned" value={detail.summary.totalYuvaks} />
          <Field label="Avg Attendance" value={`${detail.summary.avgAttendance}%`} />
          <Field label="Active" value={detail.summary.activeCount} />
          <Field label="Attention" value={detail.summary.attentionCount} />
          <Field label="High Risk" value={detail.summary.highRiskCount} />
        </div>
      </Section>

      <Section title="Sabha Split">
        <div className="flex flex-wrap gap-2">
          {detail.sabhaSplit.map((item) => (
            <span key={item.sabhaType} className="rounded-full border border-[#d9cdbb] bg-[#f1eadf] px-3 py-1 text-xs font-semibold text-[#334155] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {item.sabhaType}: {item.count}
            </span>
          ))}
          {detail.sabhaSplit.length === 0 ? <p className="text-sm text-[#64748b] dark:text-slate-400">No assigned yuvaks found.</p> : null}
        </div>
      </Section>

      <Section title="Assigned Yuvaks">
        <div className="max-h-80 overflow-y-auto rounded-xl border border-[#d9cdbb] bg-[#f1eadf] dark:border-slate-700 dark:bg-transparent">
          {detail.assignedYuvaks.map((yuvak) => (
            <div key={yuvak.id} className="space-y-2 border-b border-[#d8cdbd] px-3 py-3 last:border-b-0 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1f3552] dark:text-slate-100">{yuvak.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[#64748b] dark:text-slate-400">{yuvak.sabhaType} • {yuvak.area || 'No area'}</p>
                  {yuvak.phoneNumber ? <p className="mt-0.5 text-xs text-[#64748b] dark:text-slate-400">Phone: {yuvak.phoneNumber}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-[#1f3552] dark:text-slate-100">{yuvak.attendancePercent}%</p>
                  <p className="text-[11px] text-[#8a97aa] dark:text-slate-500">{yuvak.lastSabhaPresent === null ? 'N/A' : yuvak.lastSabhaPresent ? 'Present' : 'Absent'}</p>
                </div>
              </div>
              <RiskBadge risk={yuvak.risk} />
            </div>
          ))}
          {detail.assignedYuvaks.length === 0 ? <p className="px-3 py-6 text-center text-sm text-[#64748b] dark:text-slate-400">No assigned yuvaks found.</p> : null}
        </div>
      </Section>
    </div>
  );
}

function LeaderDetailView({ detail }: { detail: Extract<PersonDetail, { type: 'leader' }> }) {
  return (
    <div className="space-y-6">
      <RestrictedNotice reason={detail.visibility.restrictedReason} />
      <Section title="Profile">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Role" value={detail.profile.role === 'admin' ? 'Admin' : 'Leader'} />
          <Field label="Username" value={detail.profile.username} />
          <Field label="Email" value={detail.profile.email} />
          <Field label="Created" value={detail.profile.createdAt ? new Date(detail.profile.createdAt).toLocaleDateString() : null} />
        </div>
      </Section>

      <Section title="Leadership Scope">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Scope" value={detail.summary.scope} />
          <Field label="Yuvaks" value={detail.summary.totalYuvaks} />
          <Field label="KKs" value={detail.summary.totalKKs} />
          <Field label="Sabhas" value={detail.summary.sabhaCount} />
          <Field label="Avg Attendance" value={`${detail.summary.avgAttendance}%`} />
        </div>
      </Section>
    </div>
  );
}

export default function PersonDetailDrawer({ open, loading, error, detail, onClose }: PersonDetailDrawerProps) {
  if (!open) return null;

  const title = detail?.type === 'kk'
    ? detail.profile.name
    : detail?.type === 'leader'
      ? detail.profile.name
      : detail?.profile.name ?? 'Person Details';
  const subtitle = detail?.type === 'kk' ? 'KK detail' : detail?.type === 'leader' ? 'Leader detail' : detail?.type === 'yuvak' ? 'Yuvak detail' : '';
  const Icon = detail?.type === 'kk' ? Users : UserRound;

  return (
    <div className="fixed inset-0 z-[70]">
      <button className="absolute inset-0 cursor-default bg-slate-950/30" aria-label="Close person details" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[34rem] flex-col border-l border-[#cdbfae] bg-[#f6efe4] shadow-2xl dark:border-slate-700 dark:bg-[#111827]">
        <div className="flex items-start justify-between gap-4 border-b border-[#d9cdbb] px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eadfce] text-[#d97706] dark:bg-amber-500/12 dark:text-amber-300">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-[#1f3552] dark:text-slate-100">{loading ? 'Loading details...' : title}</p>
              {subtitle ? <p className="mt-0.5 text-sm text-[#64748b] dark:text-slate-400">{subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f1eadf] hover:text-[#1f3552] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close details"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center text-[#64748b] dark:text-slate-400">
              <Loader2 className="mb-3 h-7 w-7 animate-spin text-[#d97706]" />
              <p className="text-sm font-semibold">Loading complete details</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-red-700 dark:text-red-300">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            </div>
          ) : detail?.type === 'yuvak' ? (
            <YuvakDetailView detail={detail} />
          ) : detail?.type === 'kk' ? (
            <KkDetailView detail={detail} />
          ) : detail?.type === 'leader' ? (
            <LeaderDetailView detail={detail} />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-[#64748b] dark:text-slate-400">
              <CalendarDays className="mb-3 h-7 w-7" />
              <p className="text-sm font-semibold">No details selected</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
