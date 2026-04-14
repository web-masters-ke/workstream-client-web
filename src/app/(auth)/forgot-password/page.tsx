"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiPost } from "@/lib/api";

type Step = "form" | "sent";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost("/auth/forgot-password", { email });
      setStep("sent");
    } catch {
      // Even on error show "sent" to avoid email enumeration
      setStep("sent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            W
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">WorkStream</span>
        </div>

        {step === "form" ? (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Reset your password</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Enter your work email and we&apos;ll send a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Work email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending…
                  </span>
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600/10">
              <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Check your inbox</h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              If <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span> is registered,
              you&apos;ll receive a reset link shortly.
            </p>
            <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-600">
              Didn&apos;t get it? Check your spam folder or{" "}
              <button
                onClick={() => { setStep("form"); setEmail(""); }}
                className="text-brand-600 hover:underline dark:text-brand-400"
              >
                try again
              </button>
              .
            </p>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Remember it?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
