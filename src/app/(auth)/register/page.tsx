"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, setAuthToken, TOKEN_KEY } from "@/lib/api";

const INDUSTRIES = [
  "Customer Support / BPO",
  "Sales & Lead Generation",
  "Data Entry & Processing",
  "KYC & Compliance",
  "Back-Office Operations",
  "Social Media & Content",
  "Voice & Call Centre",
  "Finance & Accounts",
  "Healthcare Administration",
  "Logistics & Fulfilment",
  "Other",
] as const;

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "KES 0",
    period: "/ month",
    features: ["Up to 2 agents", "25 tasks/month", "Basic task tracking", "Community support"],
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "KES 2,999",
    period: "/ month",
    features: ["Up to 5 agents", "100 tasks/month", "Basic SLA tracking", "Email support"],
    highlight: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "KES 7,999",
    period: "/ month",
    features: ["Up to 25 agents", "Unlimited tasks", "Advanced SLA + QA", "Live chat support", "Wallet payouts", "Analytics"],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "KES 24,999",
    period: "/ month",
    features: ["Unlimited agents", "Unlimited tasks", "Custom SLA rules", "Dedicated manager", "API access", "White-label option"],
    highlight: false,
  },
] as const;

type AccountType = "BUSINESS" | "AGENT";
// Business: 4 steps. Agent: 2 steps (account → review).
type Step = 1 | 2 | 3 | 4;

interface AccountData {
  firstName: string; lastName: string; email: string;
  phone: string; password: string; confirmPassword: string;
}
interface BusinessData {
  companyName: string; industry: string; description: string;
  website: string; contactEmail: string; contactPhone: string;
  country: string; teamSize: string; agentHiringModel: string;
}

const BIZ_STEP_LABELS = ["Your account", "Your business", "Choose plan", "Review & launch"];
const AGENT_STEP_LABELS = ["Your account", "Review & join"];

function Field({ label, error, action, children }: { label: string; error?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
        {action}
      </div>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-brand-500 dark:focus:bg-zinc-900";

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("BUSINESS");
  const [step, setStep] = useState<Step>(1);
  const [account, setAccount] = useState<AccountData>({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [business, setBusiness] = useState<BusinessData>({ companyName: "", industry: "Customer Support / BPO", description: "", website: "", contactEmail: "", contactPhone: "", country: "", teamSize: "1–10", agentHiringModel: "FREELANCE" });
  const [selectedPlan, setSelectedPlan] = useState<string>("growth");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // OTP state
  const [otpPhase, setOtpPhase] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [savedToken, setSavedToken] = useState<string>("");
  const [savedUser, setSavedUser] = useState<Record<string, unknown> | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const isBiz = accountType === "BUSINESS";
  const maxStep: Step = isBiz ? 4 : 2;
  const stepLabels = isBiz ? BIZ_STEP_LABELS : AGENT_STEP_LABELS;

  function setA(field: keyof AccountData, val: string) {
    setAccount((p) => ({ ...p, [field]: val }));
    setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }
  function setB(field: keyof BusinessData, val: string) {
    setBusiness((p) => ({ ...p, [field]: val }));
    setFieldErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  }

  function validateStep1() {
    const errs: Record<string, string> = {};
    if (!account.firstName.trim()) errs.firstName = "Required";
    if (!account.lastName.trim()) errs.lastName = "Required";
    if (!account.email) errs.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) errs.email = "Invalid email";
    if (!account.phone.trim()) errs.phone = "Required";
    if (!account.password) errs.password = "Required";
    else if (account.password.length < 8) errs.password = "At least 8 characters";
    if (account.password !== account.confirmPassword) errs.confirmPassword = "Passwords don't match";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2() {
    const errs: Record<string, string> = {};
    if (!business.companyName.trim()) errs.companyName = "Required";
    if (!business.description.trim()) errs.description = "Required";
    if (!business.contactEmail) errs.contactEmail = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.contactEmail)) errs.contactEmail = "Invalid email";
    if (!business.contactPhone.trim()) errs.contactPhone = "Required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    setError(null);
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && isBiz && !validateStep2()) return;
    setStep((s) => (s < maxStep ? (s + 1) as Step : s));
  }
  function back() { setStep((s) => (s > 1 ? (s - 1) as Step : s)); }

  function loginAndRedirect(token: string, user: Record<string, unknown>) {
    setAuthToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("ws-user", JSON.stringify(user));
    }
    router.push(isBiz ? "/dashboard" : "/tasks");
  }

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{ accessToken: string; refreshToken?: string; user: Record<string, unknown> }>(
        "/auth/register",
        { email: account.email, phone: account.phone, password: account.password, firstName: account.firstName, lastName: account.lastName, role: accountType }
      );

      if (isBiz) {
        try {
          await apiPost("/businesses", { name: business.companyName, industry: business.industry, description: business.description, website: business.website || undefined, contactEmail: business.contactEmail, contactPhone: business.contactPhone, country: business.country || undefined, teamSize: business.teamSize, agentHiringModel: business.agentHiringModel, plan: selectedPlan });
        } catch { /* best effort */ }
      }

      // Save token temporarily, send OTP, show OTP screen
      setSavedToken(res.accessToken);
      setSavedUser(res.user);
      if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);

      try {
        await apiPost("/auth/send-otp", { identifier: account.email, purpose: "register" });
      } catch { /* OTP sending is best-effort */ }

      setOtpPhase(true);
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: { message?: string }; message?: string } }; message?: string };
      const msg = e.response?.data?.error?.message ?? e.response?.data?.message ?? e.message ?? "Registration failed";
      const is409 = e.response?.status === 409 || /exist|duplicate|already/i.test(msg);
      setError(is409 ? "§CONFLICT§" : msg);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setOtpError(null);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
    }
  }

  async function verifyOtp() {
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Enter all 6 digits"); return; }
    setOtpLoading(true);
    setOtpError(null);
    try {
      await apiPost("/auth/verify-otp", { identifier: account.email, token: code });
      loginAndRedirect(savedToken, savedUser!);
    } catch {
      setOtpError("Invalid or expired code. Try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function resendOtp() {
    try {
      await apiPost("/auth/send-otp", { identifier: account.email, purpose: "register" });
      setOtpError(null);
    } catch { /* ignore */ }
  }

  // ── OTP verification screen ──
  if (otpPhase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white">W</div>
          </div>
          <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">Enter verification code</h2>
          <p className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{account.email}</span>
          </p>

          <div className="mt-8 flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpInput(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="h-12 w-11 rounded-xl border border-zinc-200 bg-zinc-50 text-center text-lg font-semibold text-zinc-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            ))}
          </div>

          {otpError && (
            <p className="mt-3 text-center text-xs text-red-600 dark:text-red-400">{otpError}</p>
          )}

          <button
            type="button"
            onClick={verifyOtp}
            disabled={otpLoading}
            className="mt-6 w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {otpLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Verifying…
              </span>
            ) : "Verify code"}
          </button>

          <div className="mt-4 flex flex-col items-center gap-2">
            <button type="button" onClick={resendOtp} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
              Resend code
            </button>
            <button
              type="button"
              onClick={() => loginAndRedirect(savedToken, savedUser!)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Continue without verification →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const plan = PLANS.find((p) => p.id === selectedPlan) ?? PLANS[2];
  const reviewStep = isBiz ? 4 : 2;
  const isReview = step === reviewStep;

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12"
        style={{ background: "linear-gradient(155deg, #060b18 0%, #0c1428 55%, #101c3a 100%)" }}
      >
        <Link href="/" className="flex items-center gap-3 w-fit">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">W</div>
          <span className="text-sm font-semibold text-white">WorkStream</span>
        </Link>

        <div>
          <h1 className="text-3xl font-bold leading-tight text-white">
            {isBiz ? (
              <>Set up your<br /><span className="text-brand-400">remote operations hub.</span></>
            ) : (
              <>Join as a<br /><span className="text-brand-400">remote agent.</span></>
            )}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            {isBiz
              ? "Post jobs, assign tasks to remote agents, enforce SLAs, run QA reviews, and pay out earnings — all from one place."
              : "Pick up tasks, hit your SLAs, grow your ratings, and get paid — all from one dashboard."}
          </p>

          {/* Step progress */}
          <div className="mt-10 space-y-4">
            {stepLabels.map((label, i) => {
              const s = (i + 1) as Step;
              const active = step === s;
              const doneStep = step > s;
              return (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: doneStep ? "rgb(37 99 235)" : active ? "rgba(37,99,235,0.2)" : "rgba(255,255,255,0.06)",
                      color: doneStep || active ? "#fff" : "rgba(255,255,255,0.3)",
                      border: active ? "1.5px solid rgb(37 99 235 / 0.6)" : "1.5px solid transparent",
                    }}
                  >
                    {doneStep ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : s}
                  </div>
                  <span className={`text-sm transition-colors ${active ? "font-semibold text-white" : doneStep ? "text-slate-400" : "text-slate-600"}`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Selected plan preview (business only) */}
          {isBiz && (
            <div
              className="mt-10 rounded-2xl p-4"
              style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)" }}
            >
              <div className="text-[10px] uppercase tracking-widest text-brand-400 mb-1">Selected plan</div>
              <div className="text-lg font-bold text-white">{plan.name}</div>
              <div className="text-sm text-brand-300">{plan.price} {plan.period}</div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-400 hover:underline">Sign in</Link>
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 dark:bg-zinc-950 lg:w-[58%] lg:px-16">
        {/* Mobile header */}
        <div className="mb-6 flex w-full max-w-lg items-center justify-between lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">W</div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">WorkStream</span>
          </Link>
          <span className="text-xs text-zinc-400">Step {step} of {maxStep}</span>
        </div>

        <div className="w-full max-w-lg">
          {/* Account type toggle — shown only on step 1 */}
          {step === 1 && (
            <div className="mb-6">
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">I want to sign up as</p>
              <div className="flex rounded-xl border border-zinc-200 p-1 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => { setAccountType("BUSINESS"); setStep(1); setError(null); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${accountType === "BUSINESS" ? "bg-brand-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
                >
                  A business / org
                </button>
                <button
                  type="button"
                  onClick={() => { setAccountType("AGENT"); setStep(1); setError(null); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${accountType === "AGENT" ? "bg-brand-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"}`}
                >
                  An agent / freelancer
                </button>
              </div>
            </div>
          )}

          {/* Step heading */}
          <div className="mb-8">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
              Step {step} of {maxStep}
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{stepLabels[step - 1]}</h2>
          </div>

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name" error={fieldErrors.firstName}>
                  <input className={inputCls} value={account.firstName} onChange={(e) => setA("firstName", e.target.value)} placeholder="Grace" />
                </Field>
                <Field label="Last name" error={fieldErrors.lastName}>
                  <input className={inputCls} value={account.lastName} onChange={(e) => setA("lastName", e.target.value)} placeholder="Mwangi" />
                </Field>
              </div>
              <Field label="Work email" error={fieldErrors.email}>
                <input className={inputCls} type="email" value={account.email} onChange={(e) => setA("email", e.target.value)} placeholder="grace@company.com" autoComplete="email" />
              </Field>
              <Field label="Phone number" error={fieldErrors.phone}>
                <input className={inputCls} type="tel" value={account.phone} onChange={(e) => setA("phone", e.target.value)} placeholder="+254 700 000 000" />
              </Field>
              <Field
                label="Password"
                error={fieldErrors.password}
                action={
                  <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <input type="checkbox" checked={showPwd} onChange={e => setShowPwd(e.target.checked)} className="h-3 w-3 cursor-pointer" />
                    Show
                  </label>
                }
              >
                <input className={inputCls} type={showPwd ? "text" : "password"} value={account.password} onChange={(e) => setA("password", e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" />
              </Field>
              <Field
                label="Confirm password"
                error={fieldErrors.confirmPassword}
                action={
                  <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <input type="checkbox" checked={showConfirmPwd} onChange={e => setShowConfirmPwd(e.target.checked)} className="h-3 w-3 cursor-pointer" />
                    Show
                  </label>
                }
              >
                <input className={inputCls} type={showConfirmPwd ? "text" : "password"} value={account.confirmPassword} onChange={(e) => setA("confirmPassword", e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
              </Field>
            </div>
          )}

          {/* ── STEP 2 (Business only): Business details ── */}
          {isBiz && step === 2 && (
            <div className="space-y-4">
              <div className="mb-2 rounded-xl bg-brand-50 px-4 py-3 text-xs text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                You&apos;re setting up your remote operations workspace. WorkStream lets you post jobs, assign tasks with SLA timers, run QA reviews, track live performance, and pay out earnings — all from one dashboard.
              </div>
              <Field label="Company name" error={fieldErrors.companyName}>
                <input className={inputCls} value={business.companyName} onChange={(e) => setB("companyName", e.target.value)} placeholder="Acme BPO Kenya Ltd" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Industry">
                  <select className={inputCls} value={business.industry} onChange={(e) => setB("industry", e.target.value)}>
                    {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Team size">
                  <select className={inputCls} value={business.teamSize} onChange={(e) => setB("teamSize", e.target.value)}>
                    {["1–10", "11–50", "51–200", "201–500", "500+"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Agent hiring model">
                <select className={inputCls} value={business.agentHiringModel} onChange={(e) => setB("agentHiringModel", e.target.value)}>
                  <option value="FREELANCE">Freelance agents (on-demand)</option>
                  <option value="EMPLOYED">Employed staff</option>
                  <option value="HYBRID">Hybrid (mix of both)</option>
                </select>
              </Field>
              <Field label="Business description" error={fieldErrors.description}>
                <textarea className={`${inputCls} min-h-[80px] resize-none`} value={business.description} onChange={(e) => setB("description", e.target.value)} placeholder="Brief description of what your business does and what tasks agents will handle..." />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Operations email" error={fieldErrors.contactEmail}>
                  <input className={inputCls} type="email" value={business.contactEmail} onChange={(e) => setB("contactEmail", e.target.value)} placeholder="ops@company.com" />
                </Field>
                <Field label="Operations phone" error={fieldErrors.contactPhone}>
                  <input className={inputCls} type="tel" value={business.contactPhone} onChange={(e) => setB("contactPhone", e.target.value)} placeholder="+254..." />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Country">
                  <select className={inputCls} value={business.country} onChange={(e) => setB("country", e.target.value)}>
                    {["Kenya", "Uganda", "Tanzania", "Rwanda", "Ethiopia", "Nigeria", "Ghana", "South Africa", "Other"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Website (optional)">
                  <input className={inputCls} value={business.website} onChange={(e) => setB("website", e.target.value)} placeholder="https://company.com" />
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 3 (Business only): Plan ── */}
          {isBiz && step === 3 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p.id)}
                  className={`relative rounded-2xl border-2 p-5 text-left transition-all ${
                    selectedPlan === p.id
                      ? "border-brand-600 bg-brand-50 dark:bg-brand-950/30"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-[10px] font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <div className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</div>
                  <div className="text-xl font-bold text-brand-600">{p.price}</div>
                  <div className="mb-4 text-[11px] text-zinc-400">{p.period}</div>
                  <ul className="space-y-1.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {selectedPlan === p.id && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Review step (step 4 for biz, step 2 for agent) ── */}
          {isReview && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Account</div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{account.firstName} {account.lastName}</div>
                <div className="text-sm text-zinc-500">{account.email}</div>
                <div className="text-sm text-zinc-500">{account.phone}</div>
                <div className="mt-1.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isBiz ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>
                    {isBiz ? "Business account" : "Agent account"}
                  </span>
                </div>
              </div>

              {isBiz && (
                <>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Business</div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{business.companyName}</div>
                    <div className="text-xs text-zinc-400">{business.industry} · {business.teamSize} agents · {business.agentHiringModel}</div>
                    <div className="mt-1 text-sm text-zinc-500">{business.description}</div>
                  </div>

                  <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-700 dark:bg-zinc-900">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">Plan</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{plan.name}</span>
                      <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{plan.price}</span>
                      <span className="text-xs text-zinc-400">{plan.period}</span>
                    </div>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <svg className="h-3 w-3 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error === "§CONFLICT§" ? (
                    <span>
                      An account with this email already exists.{" "}
                      <Link href="/login" className="font-semibold underline">Sign in instead</Link>
                    </span>
                  ) : error}
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={back}
                className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                Back
              </button>
            )}
            {!isReview ? (
              <button
                type="button"
                onClick={next}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {isBiz ? "Launching workspace…" : "Creating account…"}
                  </span>
                ) : (
                  isBiz ? "Launch my workspace 🚀" : "Join WorkStream 🚀"
                )}
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
