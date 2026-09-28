import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { getRoleHomePath, getServerSession } from '@/lib/auth/session';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const session = await getServerSession();

  if (session) {
    redirect(getRoleHomePath((session.user as { role?: string }).role));
  }

  const resolvedSearchParams = await searchParams;
  const nextPath = resolvedSearchParams?.next;
  const callbackUrl = nextPath?.startsWith('/') && nextPath !== '/' ? nextPath : '/post-login';

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="min-h-screen bg-[linear-gradient(180deg,#0f172a_0%,#101a2f_100%)] lg:bg-[linear-gradient(90deg,#da7b00_0%,#f29a06_44%,#0f172a_44%,#111c33_100%)]">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
          <div className="grid w-full items-center gap-5 lg:grid-cols-[1fr_0.88fr] lg:gap-6">
            <div className="hidden space-y-5 rounded-2xl bg-[linear-gradient(180deg,#d98503_0%,#ee9809_100%)] p-5 text-white sm:p-6 lg:block lg:rounded-none lg:bg-none lg:p-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#d77a07] shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
                  S
                </div>
                <div className="text-[1.65rem] font-semibold tracking-tight">Sabha Analytics</div>
              </div>

              <div className="max-w-md space-y-4">
                <h1 className="max-w-96 text-[2.75rem] font-bold leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-[3rem]">
                  Secure access for your Sabha dashboard.
                </h1>

                <div className="space-y-3.5 pt-1 text-white/90">
                  {[
                    ['Real-time Analytics', 'Track attendance trends and session impact instantly.'],
                    ['KK Insights', 'Monitor follow-up performance and workload distribution.'],
                    ['Akshar Assistant', 'Get AI-powered suggestions for topic planning.'],
                  ].map(([title, copy]) => (
                    <div key={title} className="flex items-start gap-3">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/18 text-sm text-white">
                        <span className="h-2 w-2 rounded-full bg-white" />
                      </span>
                      <div>
                        <p className="text-[1.03rem] font-semibold tracking-tight text-white">{title}</p>
                        <p className="mt-1 text-[0.92rem] leading-6 text-white/80">{copy}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="pt-1 text-[0.88rem] text-white/70">©2026 Sampark Management System • V1.0.4</p>
              </div>
            </div>

            <div className="mx-auto w-full max-w-sm lg:justify-self-end">
              <div className="rounded-2xl border border-slate-700/70 bg-[linear-gradient(180deg,rgba(37,49,74,0.98),rgba(33,44,68,0.98))] p-6 shadow-[0_18px_42px_rgba(2,6,23,0.28)]">
                <div className="mb-5 space-y-1">
                  <h2 className="text-xl font-bold tracking-tight text-slate-50">Welcome Back</h2>
                  <p className="text-[0.9rem] leading-5 text-slate-400">
                    Enter your credentials to access your dashboard.
                  </p>
                </div>
                <LoginForm callbackUrl={callbackUrl} />
              </div>

              <p className="mt-3 text-center text-[0.85rem] text-slate-400">
                Don&apos;t have an account?{' '}
                <span className="font-semibold text-orange-400">rajchauhan3019@gmail.com</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
