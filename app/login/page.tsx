import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { getServerSession } from '@/lib/auth/session';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const session = await getServerSession();

  if (session) {
    redirect('/');
  }

  const resolvedSearchParams = await searchParams;
  const callbackUrl = resolvedSearchParams?.next?.startsWith('/') ? resolvedSearchParams.next : '/';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
              Sabha Analytics
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-slate-50 sm:text-5xl">
                Secure access for your Sabha dashboard.
              </h1>
              <p className="mx-auto max-w-xl text-sm leading-7 text-slate-300 sm:text-base lg:mx-0">
                Sign in with your admin username to view attendance analytics, KK insights, and the Akshar assistant across desktop and mobile.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
              <div className="mb-6 space-y-2">
                <h2 className="text-2xl font-semibold text-slate-50">Login</h2>
                <p className="text-sm text-slate-400">
                  Use your username and password to continue.
                </p>
              </div>
              <LoginForm callbackUrl={callbackUrl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
