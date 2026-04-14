"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiPost, TOKEN_KEY } from "@/lib/api";

interface LoginResponse {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  user?: { id: string; email: string; name: string };
}

function getErrMsg(err: unknown): string {
  if (!err || typeof err !== "object") return "Login failed. Please try again.";
  const e = err as { response?: { data?: { message?: string }; status?: number }; message?: string };
  const status = e.response?.status;
  const msg = e.response?.data?.message ?? e.message ?? "";
  if (status === 401 || /invalid.*credential|wrong.*password|incorrect/i.test(msg)) return "Invalid email or password.";
  if (status === 403 && /suspend/i.test(msg)) return "Your account has been suspended. Contact support.";
  if (status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  return msg || "Login failed. Please try again.";
}

const FEATURES = [
  { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", label: "Post jobs & assign tasks to remote agents" },
  { icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", label: "SLA timers & auto-escalation built in" },
  { icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z", label: "Pay out earnings via M-Pesa or bank" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<LoginResponse>("/auth/login", { email, password });
      const token = res.accessToken ?? res.token ?? "";
      localStorage.setItem(TOKEN_KEY, token);
      if (res.refreshToken) localStorage.setItem("ws-refresh-token", res.refreshToken);
      if (res.user) localStorage.setItem("ws-user", JSON.stringify(res.user));
      router.push("/dashboard");
    } catch (err) {
      setError(getErrMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left — brand panel ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14"
        style={{ background: "linear-gradient(155deg, #060b18 0%, #0c1428 55%, #101c3a 100%)" }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 w-fit">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">W</div>
          <span className="text-sm font-semibold text-white">WorkStream</span>
        </Link>

        {/* Middle */}
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-600/30 bg-brand-600/10 px-4 py-1.5 text-xs font-medium text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Remote Workforce Management
          </div>
          <h1 className="text-4xl font-bold leading-tight text-white">
            Your operations hub.<br />
            <span className="text-brand-400">Agents. Tasks. Payouts.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            The complete platform for businesses running remote agent teams across East Africa.
          </p>

          <div className="mt-8 space-y-3">
            {FEATURES.map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600/15">
                  <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                  </svg>
                </div>
                <span className="text-sm text-slate-300">{label}</span>
              </div>
            ))}
          </div>

          {/* Fake dashboard preview card */}
          <div
            className="mt-10 rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Today&apos;s tasks</span>
              <span className="text-[10px] text-slate-600">Live</span>
            </div>
            {[
              { title: "Customer onboarding call", agent: "Grace M.", status: "IN PROGRESS", color: "bg-blue-500" },
              { title: "Data entry — Form batch #44", agent: "Brian O.", status: "COMPLETED", color: "bg-emerald-500" },
              { title: "Support ticket triage", agent: "Aisha K.", status: "PENDING", color: "bg-amber-500" },
            ].map(({ title, agent, status, color }) => (
              <div key={title} className="mb-2 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div>
                  <div className="text-xs font-medium text-slate-200">{title}</div>
                  <div className="text-[10px] text-slate-500">{agent}</div>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${color}`} />
                  <span className="text-[10px] text-slate-400">{status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-[11px] text-slate-600">
          <span>12K+ agents managed</span>
          <span>·</span>
          <span>KES 480M+ paid out</span>
          <span>·</span>
          <span>99.2% SLA rate</span>
        </div>
      </div>

      {/* ── Right — form ── */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 dark:bg-zinc-950 lg:w-[48%] lg:px-16">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">W</div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">WorkStream</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Welcome back</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to manage your agents, jobs, and payouts.
            </p>
          </div>

          {/* Dev hint */}
          <div className="mb-5 rounded-lg bg-zinc-100 px-3.5 py-2.5 text-[11px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500">
            <span className="font-semibold text-zinc-700 dark:text-zinc-400">Seed login:</span>{" "}
            <span className="font-mono">owner@acme.com</span> / <span className="font-mono">Password123!</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900"
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Password</label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={showPwd}
                      onChange={(e) => setShowPwd(e.target.checked)}
                      className="h-3 w-3 cursor-pointer"
                    />
                    Show password
                  </label>
                  <Link href="/forgot-password" className="text-[11px] text-zinc-400 hover:underline dark:text-zinc-500">
                    Forgot?
                  </Link>
                </div>
              </div>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter password"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900"
              />
            </div>

            {/* Remember me */}
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
              />
              Keep me signed in
            </label>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Set up your workspace
            </Link>
          </p>

          <p className="mt-6 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
            By signing in you agree to our{" "}
            <Link href="#" className="hover:underline">Terms</Link>{" "}
            and{" "}
            <Link href="#" className="hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
