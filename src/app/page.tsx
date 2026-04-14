'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/lib/theme';

// ─── Images ───────────────────────────────────────────────────────────────────
const IMAGES = {
  // African professionals — Nairobi/East Africa context
  hero:      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80', // Black business team, boardroom
  dashboard: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80', // data/charts (neutral)
  jobs:      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=80', // diverse Black team collaborating
  agents:    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=900&q=80', // Black woman at laptop
  payouts:   'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=900&q=80', // mobile payment (neutral)
  qa:        'https://images.unsplash.com/photo-1531498860502-7c67cf519d9e?w=900&q=80', // team review
  analytics: 'https://images.unsplash.com/photo-1543286386-713bdd548da4?w=900&q=80', // analytics screen (neutral)
  admin:     'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=900&q=80', // Black professional at computer
  cta:       'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1400&q=80', // Black team
  av1:       'https://images.unsplash.com/photo-1531123414780-f74242c2b052?w=100&q=80', // Black Kenyan woman
  av2:       'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=100&q=80', // Black woman professional
  av3:       'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=100&q=80', // Black woman ops lead
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const STATS = [
  { value: '12,480+', label: 'Active Agents' },
  { value: 'KES 480M+', label: 'Total Paid Out' },
  { value: '38K+', label: 'Daily Task Completions' },
  { value: '99.2%', label: 'SLA Compliance Rate' },
];

const FEATURES = [
  {
    tag: 'Live Operations',
    title: 'Your Command Centre, Always Live',
    body: 'See every active job, agent status, SLA countdown, and payment the moment it happens. Real-time data across your entire distributed team — no refresh, no guessing.',
    bullets: ['Real-time job board with live status updates', 'Agent presence tracking — online, busy, or offline', 'Instant SLA breach alerts and auto-escalation', 'One-screen overview of all your KPIs'],
    image: IMAGES.dashboard,
    alt: 'Operations dashboard on screen',
    reverse: false,
  },
  {
    tag: 'Jobs & Tasks',
    title: 'Post Jobs and Assign Tasks in Seconds',
    body: 'Create structured job templates, set skill requirements, and auto-assign to the best available agents based on skill, location, and availability — with zero manual effort.',
    bullets: ['Job templates with required skills and location filters', 'Auto-assignment rules for shift and coverage gaps', 'Step-by-step task checklists and deliverables', 'Re-assign instantly when an agent goes offline'],
    image: IMAGES.jobs,
    alt: 'Team managing jobs collaboratively',
    reverse: true,
  },
  {
    tag: 'Agent Management',
    title: 'Know Every Agent, Their Skills and Output',
    body: 'Maintain a verified directory of your entire remote team. Track performance scores, attendance, shift history, and KYC status all in one place — accessible from anywhere.',
    bullets: ['Agent profiles with skills, ratings, and live availability', 'Attendance tracking with check-in and check-out logs', 'Performance scores based on SLA, QA, and completion rate', 'KYC verification status and document management'],
    image: IMAGES.agents,
    alt: 'Professional female agent at her desk',
    reverse: false,
  },
  {
    tag: 'M-Pesa Payouts',
    title: 'Pay Out Earnings via M-Pesa in One Click',
    body: 'Run bulk payouts to all your agents in seconds. WorkStream disburses via M-Pesa B2C, tracks every transaction in real time, and generates audit-ready pay slips automatically.',
    bullets: ['Bulk M-Pesa B2C payouts for your entire team at once', 'Per-agent earning summaries and digital pay slips', 'Configurable schedules — daily, weekly, or on-demand', 'Full transaction history and reconciliation CSV exports'],
    image: IMAGES.payouts,
    alt: 'Mobile payment via M-Pesa',
    reverse: true,
  },
  {
    tag: 'QA & Escalations',
    title: 'Score Every Interaction, Escalate Automatically',
    body: 'Run call monitoring, task reviews, or delivery audits with configurable scorecards. Coaches leave feedback, agents improve, and supervisors are notified the moment an SLA breaches.',
    bullets: ['Configurable QA scorecards per job type', 'Call recording review with timestamped coaching notes', 'Auto-escalation on SLA breach — routed to the right person', 'Resolution tracking with average close-time analytics'],
    image: IMAGES.qa,
    alt: 'Team doing quality review together',
    reverse: false,
  },
  {
    tag: 'Analytics',
    title: 'Data-Driven Decisions, Not Guesswork',
    body: 'Turn your operations data into real clarity. Track completion rates, agent utilization, payout trends, and SLA performance over time — all in clean dashboards built for ops leads.',
    bullets: ['Completion rate, failure rate and utilization KPIs', 'Agent performance leaderboards and team rankings', 'SLA trend analysis and breach root-cause breakdown', 'Payout cost vs output productivity reports'],
    image: IMAGES.analytics,
    alt: 'Analytics charts on a screen',
    reverse: true,
  },
];

const MODULES = [
  { emoji: '📊', color: 'bg-brand-600',   title: 'Live Dashboard',   desc: 'Real-time ops view — jobs, agents, SLA, payouts.',      href: '/dashboard' },
  { emoji: '📋', color: 'bg-blue-600',    title: 'Jobs & Tasks',     desc: 'Post, assign, track and close tasks end-to-end.',       href: '/jobs' },
  { emoji: '👥', color: 'bg-violet-600',  title: 'Agent Management', desc: 'Directory, KYC, skills, ratings and availability.',     href: '/agents' },
  { emoji: '💸', color: 'bg-emerald-600', title: 'M-Pesa Payouts',   desc: 'Bulk B2C disbursements with pay slips and history.',    href: '/payouts' },
  { emoji: '⏱️', color: 'bg-rose-600',    title: 'SLA Monitoring',   desc: 'Per-job SLA timers, auto-escalation chains.',          href: '/sla' },
  { emoji: '🎯', color: 'bg-amber-600',   title: 'QA Reviews',       desc: 'Scorecards, call monitoring and coaching notes.',       href: '/qa' },
  { emoji: '🗓️', color: 'bg-sky-600',     title: 'Shift Scheduling', desc: 'Weekly rosters, availability and swap requests.',       href: '/shifts' },
  { emoji: '📈', color: 'bg-teal-600',    title: 'Analytics',        desc: 'KPI dashboards, trends and CSV/PDF exports.',          href: '/analytics' },
];

const TESTIMONIALS = [
  {
    quote: 'WorkStream completely changed how we run our agent team. Bookings are structured, SLA tracking is automatic, and M-Pesa payouts that used to take a whole afternoon now take ten minutes.',
    name: 'Sarah Wanjiru',
    role: 'Head of Ops, Savannah BPO — Nairobi',
    image: IMAGES.av1,
  },
  {
    quote: 'The QA scorecard alone justified the cost. Agents know exactly what to improve, our supervisors spend less time firefighting, and client satisfaction jumped 18% in six weeks.',
    name: 'Amina Hassan',
    role: 'Operations Manager, PeakOps — Mombasa',
    image: IMAGES.av2,
  },
  {
    quote: 'We went from WhatsApp chaos to a fully structured remote team in two weeks. SLA alerts, auto-escalation, M-Pesa payouts — it all just works.',
    name: 'Joyce Kamau',
    role: 'Founder, Nairobi Connect — Nairobi',
    image: IMAGES.av3,
  },
];

const PLANS = [
  {
    name: 'Starter',
    price: 'KES 2,999',
    period: '/month',
    description: 'For small teams getting started with remote agents.',
    features: ['Up to 25 active agents', '5 active jobs at once', 'M-Pesa payouts', 'Basic SLA monitoring', 'Team chat messaging', 'Email support'],
    popular: false,
    cta: 'Get started free',
  },
  {
    name: 'Growth',
    price: 'KES 7,999',
    period: '/month',
    description: 'For scaling operations teams who need full control.',
    features: ['Up to 150 active agents', 'Unlimited active jobs', 'Bulk M-Pesa payouts', 'SLA + auto-escalation', 'QA scorecards', 'Shift scheduling', 'Analytics dashboard', 'Priority support'],
    popular: true,
    cta: 'Start free trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large multi-team organisations and BPOs.',
    features: ['Unlimited agents and jobs', 'All Growth features', 'Custom QA scorecards', 'Advanced analytics and reports', 'KYC workflow management', 'Dedicated account manager', 'SLA-backed support', 'API access'],
    popular: false,
    cta: 'Contact sales',
  },
];

const FAQS = [
  { q: 'How quickly can I get started?', a: 'You can be live in under 20 minutes. Create your account, choose a plan, top up your wallet via M-Pesa, and post your first job. Agents receive an invite link and can be accepting tasks within the hour.' },
  { q: 'Does WorkStream support M-Pesa payments?', a: 'Yes. M-Pesa B2C is built in for agent payouts. You can also top up your WorkStream wallet via M-Pesa Paybill. All amounts are in Kenyan Shillings — no dollar FX headaches.' },
  { q: 'What is an SLA and how does auto-escalation work?', a: 'Every job has an SLA deadline — a time limit for completion. WorkStream shows countdown timers on each task. When a task is about to breach, the agent is warned. When it breaches, supervisors are automatically notified and the task is escalated according to your configured escalation chain.' },
  { q: 'Can I manage multiple workspaces or teams?', a: 'Yes. WorkStream supports multiple workspaces under one business account. Each workspace has its own agents, jobs, and reporting — perfect for running separate teams or departments.' },
  { q: 'Is there a mobile app for agents?', a: 'Yes. Agents use the WorkStream mobile app on Android and iOS to accept tasks, check in, submit deliverables, and track their earnings and pay slips.' },
  { q: 'What happens to my data if I cancel?', a: 'Your data belongs to you. You can export everything at any time. We retain your data for 90 days after cancellation for easy re-activation, then securely delete it.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Stars() {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="h-4 w-4 text-brand-500" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">W</div>
            <span className={`text-base font-black ${scrolled ? 'text-gray-900 dark:text-white' : 'text-white'}`}>WorkStream</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {[['Features', '#features'], ['Agents', '#agents'], ['Payouts', '#payouts'], ['Pricing', '#pricing']].map(([l, h]) => (
              <a key={l} href={h} className={`text-sm font-medium transition-colors ${scrolled ? 'text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400' : 'text-white/80 hover:text-white'}`}>{l}</a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className={`rounded-lg p-2 transition-colors ${scrolled ? 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800' : 'text-white/70 hover:bg-white/10'}`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <Link href="/login" className={`text-sm font-medium transition-colors ${scrolled ? 'text-gray-700 dark:text-gray-300 hover:text-brand-600' : 'text-white/80 hover:text-white'}`}>Log in</Link>
            <Link href="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-700">Get Started Free</Link>
          </div>

          <button onClick={() => setOpen(!open)} className={`p-2 rounded-lg md:hidden ${scrolled ? 'text-gray-700 dark:text-gray-300' : 'text-white'}`}>
            {open
              ? <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              : <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            }
          </button>
        </div>

        {open && (
          <div className="border-t border-gray-100 bg-white py-4 dark:border-gray-800 dark:bg-gray-950 md:hidden">
            {[['Features', '#features'], ['Agents', '#agents'], ['Payouts', '#payouts'], ['Pricing', '#pricing']].map(([l, h]) => (
              <a key={l} href={h} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium text-gray-700 dark:text-gray-300">{l}</a>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/login" className="block py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Log in</Link>
              <Link href="/register" className="block rounded-lg bg-brand-600 py-2.5 text-center text-sm font-bold text-white">Get Started Free</Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [activeQ, setActiveQ] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-900">
        {/* BG photo */}
        <div className="absolute inset-0">
          <img src={IMAGES.hero} alt="Remote workforce team" className="h-full w-full object-cover object-center" />
          {/* Base dark layer */}
          <div className="absolute inset-0 bg-gray-950/80" />
          {/* Top scrim — keeps navbar text readable over any photo */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-gray-950/80 to-transparent" />
          {/* Left gradient — darkens the text content area */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950/70 via-gray-950/30 to-transparent" />
        </div>

        {/* Floating card — top right */}
        <div className="absolute right-10 top-28 hidden animate-float lg:block">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-md">
            <div className="text-2xl font-black">38K+</div>
            <div className="text-xs opacity-75">Tasks completed today</div>
          </div>
        </div>

        {/* Floating card — bottom right */}
        <div className="absolute bottom-32 right-16 hidden lg:block animate-float" style={{ animationDelay: '1.5s' }}>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-sm font-medium">Payout sent</span>
            </div>
            <div className="mt-1 text-xs opacity-70">Grace M. · KES 8,500 via M-Pesa</div>
          </div>
        </div>

        {/* Floating card — left */}
        <div className="absolute left-10 bottom-40 hidden animate-float lg:block" style={{ animationDelay: '0.8s' }}>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-md">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-xs font-medium">SLA Warning</span>
            </div>
            <div className="text-xs opacity-70">Ticket #288 · 18 min left</div>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
              Remote Workforce Management · East Africa
            </div>

            <h1 className="mb-6 text-5xl font-black leading-[1.06] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7)] sm:text-6xl lg:text-7xl">
              Run Your Remote<br />
              Agent Team<br />
              <span className="text-brand-400">at Scale.</span>
            </h1>

            <p className="mb-8 max-w-xl text-lg leading-relaxed text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
              WorkStream is the complete operations platform for businesses managing distributed agent teams — post jobs, track SLAs, run QA, and pay out via M-Pesa.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-brand-700">
                Start Free — No Card Needed
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
              </Link>
              <a href="#features" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                See How It Works
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center gap-5">
              <div className="flex -space-x-3">
                {[IMAGES.av1, IMAGES.av2, IMAGES.av3].map((src, i) => (
                  <img key={i} src={src} alt="Customer" className="h-10 w-10 rounded-full border-2 border-white object-cover" />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1.5"><Stars /><span className="ml-1 text-sm text-white">4.9/5</span></div>
                <div className="text-xs text-white/55">from 1,200+ operations managers</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/35">
          <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L10 15.586l5.293-5.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-white py-16 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-10 text-center text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Trusted by fast-growing businesses across East Africa
          </p>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center dark:border-gray-800 dark:bg-gray-900">
                <div className="text-3xl font-black text-gray-900 dark:text-white lg:text-4xl">{s.value}</div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTRO ────────────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-white py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4 text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">
            Built for the East African Remote Workforce
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-500 dark:text-gray-400">
            From solo supervisors managing 10 agents to BPOs running thousands of remote workers — WorkStream scales with you. It runs on M-Pesa from day one and is built around how African businesses actually operate.
          </p>
        </div>
      </section>

      {/* ── ALTERNATING FEATURES ─────────────────────────────────────────────── */}
      <section id="features">
        {FEATURES.map((f, i) => (
          <div
            key={f.tag}
            id={f.tag.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '')}
            className={`border-b border-gray-100 py-20 dark:border-gray-800 ${i % 2 === 0 ? 'bg-white dark:bg-gray-950' : 'bg-gray-50 dark:bg-gray-900'}`}
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className={`flex flex-col items-center gap-12 lg:gap-16 ${f.reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
                {/* Image */}
                <div className="w-full flex-1">
                  <div className="relative overflow-hidden rounded-2xl">
                    <img src={f.image} alt={f.alt} className="h-80 w-full object-cover lg:h-[420px]" />
                    <div className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-black text-white">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  </div>
                </div>
                {/* Text */}
                <div className="flex-1">
                  <span className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                    {f.tag}
                  </span>
                  <h3 className="mb-4 text-3xl font-black leading-tight text-gray-900 dark:text-white sm:text-4xl">
                    {f.title}
                  </h3>
                  <p className="mb-6 text-lg leading-relaxed text-gray-500 dark:text-gray-400">
                    {f.body}
                  </p>
                  <ul className="space-y-3">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600">
                          <CheckIcon />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Link href="/register" className="inline-flex items-center gap-2 font-bold text-brand-600 transition-all hover:gap-3 dark:text-brand-400 group">
                      Get started
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── MODULE GRID ──────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-gray-50 py-20 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
              Complete Platform
            </span>
            <h2 className="mb-4 text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">Every Module Your Team Needs</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-500 dark:text-gray-400">
              Eight tightly integrated modules covering every aspect of running a remote agent operation across East Africa.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <Link
                key={m.title}
                href={m.href}
                className="group flex cursor-pointer flex-col rounded-2xl border-2 border-gray-100 bg-white p-6 transition-all duration-300 hover:-translate-y-2 hover:border-brand-400 hover:shadow-2xl dark:border-gray-800 dark:bg-gray-800 dark:hover:border-brand-500"
              >
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-xl text-white ${m.color}`}>
                  {m.emoji}
                </div>
                <div className="mb-2 font-bold text-gray-900 dark:text-white">{m.title}</div>
                <div className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{m.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── ADMIN SECTION ────────────────────────────────────────────────────── */}
      <section id="admin" className="border-b border-gray-100 bg-white py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
            <div className="w-full flex-1">
              <div className="relative overflow-hidden rounded-2xl">
                <img src={IMAGES.admin} alt="Admin console team" className="h-80 w-full object-cover lg:h-[420px]" />
                {/* Admin UI overlay */}
                <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-gray-900/92 p-5 backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-[10px] font-black text-white">WS</div>
                    <span className="text-xs font-semibold text-white">Admin Console · Internal</span>
                    <span className="ml-auto text-[10px] text-slate-500">All actions logged</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[['Businesses', '1,284'], ['Agents', '12,480'], ['KES Paid', '480M'], ['SLA', '99.2%']].map(([l, v]) => (
                      <div key={l} className="rounded-lg bg-white/5 p-2.5">
                        <div className="text-[10px] text-slate-500">{l}</div>
                        <div className="text-sm font-black text-white">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <span className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                Admin Back-Office
              </span>
              <h3 className="mb-4 text-3xl font-black leading-tight text-gray-900 dark:text-white sm:text-4xl">
                Complete Platform Control for Operators
              </h3>
              <p className="mb-6 text-lg leading-relaxed text-gray-500 dark:text-gray-400">
                The Admin Console gives your platform team full visibility — manage businesses, verify KYC, review disputes, oversee payouts, and monitor platform health from one secure console.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['🏢', 'Business Management', 'Onboard, manage subscriptions, disable non-compliant accounts'],
                  ['🪪', 'KYC & Compliance', 'Review identity documents and business registration files'],
                  ['⚖️', 'Disputes & Refunds', 'Structured workflow for payment disputes and refunds'],
                  ['💰', 'Payout Oversight', 'All platform-wide runs with reconciliation reports'],
                  ['📊', 'Analytics & Reports', 'SLA, completions, revenue and agent KPIs'],
                  ['🔐', 'Admin Roles', 'Finance-only, KYC-only, super-admin — granular access'],
                ].map(([icon, title, desc]) => (
                  <div key={title as string} className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-1 text-lg">{icon}</div>
                    <div className="text-xs font-bold text-gray-900 dark:text-white">{title}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-500">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-gray-50 py-20 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
              What clients say
            </span>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">Loved by Operations Teams</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="flex flex-col rounded-2xl border border-gray-100 bg-white p-8 dark:border-gray-800 dark:bg-gray-800">
                <Stars />
                <p className="mt-5 flex-1 text-base leading-relaxed text-gray-600 dark:text-gray-300">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <img src={t.image} alt={t.name} className="h-11 w-11 rounded-full object-cover" />
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{t.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-b border-gray-100 bg-white py-20 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
              Pricing
            </span>
            <h2 className="mb-4 text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">Simple KES Pricing, No Surprises</h2>
            <p className="mx-auto max-w-xl text-gray-500 dark:text-gray-400">Pay in Kenyan Shillings via M-Pesa. All plans include the full feature set. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl p-8 ${p.popular ? 'bg-brand-600 text-white' : 'border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900'}`}
              >
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-1 text-[11px] font-black text-white dark:bg-white dark:text-gray-900">
                    Most popular
                  </div>
                )}
                <div className={`text-sm font-bold ${p.popular ? 'text-brand-200' : 'text-gray-500 dark:text-gray-400'}`}>{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black">{p.price}</span>
                  <span className={`text-sm ${p.popular ? 'text-brand-200' : 'text-gray-400'}`}>{p.period}</span>
                </div>
                <div className={`mt-1 text-sm ${p.popular ? 'text-brand-200' : 'text-gray-500 dark:text-gray-400'}`}>{p.description}</div>
                <ul className="mt-8 flex-1 space-y-3">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${p.popular ? 'bg-white/20' : 'bg-brand-600'}`}>
                        <CheckIcon />
                      </div>
                      <span className={`text-sm ${p.popular ? 'text-brand-100' : 'text-gray-700 dark:text-gray-300'}`}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.name === 'Enterprise' ? 'mailto:hello@workstream.co.ke' : '/register'}
                  className={`mt-8 block w-full rounded-xl py-3.5 text-center text-sm font-bold transition-all ${p.popular ? 'bg-white text-brand-700 hover:bg-brand-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
            Top up wallet via M-Pesa Paybill · All prices exclude VAT · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-gray-50 py-20 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <span className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
              FAQ
            </span>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white sm:text-4xl">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-800">
                <button
                  onClick={() => setActiveQ(activeQ === i ? null : i)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                >
                  <span className="font-bold text-gray-900 dark:text-white">{faq.q}</span>
                  <svg
                    className={`h-5 w-5 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${activeQ === i ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {activeQ === i && (
                  <div className="border-t border-gray-100 px-6 pb-5 pt-4 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gray-900 py-28">
        <div className="absolute inset-0">
          <img src={IMAGES.cta} alt="Operations hub" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gray-950/85" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/60 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/90">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-400" />
            Get started today
          </div>
          <h2 className="mb-5 text-4xl font-black text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.7)] sm:text-5xl lg:text-6xl">
            Your Operations Hub<br />
            <span className="text-brand-400">is Ready.</span>
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
            Join hundreds of businesses running remote agent teams on WorkStream. Set up in minutes, post your first job today.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-9 py-4 text-base font-bold text-white transition-colors hover:bg-brand-700">
              Set Up Your Workspace
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-9 py-4 text-base font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/10">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">W</div>
                <span className="font-black text-white">WorkStream</span>
              </Link>
              <p className="text-xs leading-relaxed text-gray-500">
                The complete remote workforce management platform for East Africa.
              </p>
            </div>

            {[
              { title: 'Product', links: [{ l: 'Dashboard', h: '/dashboard' }, { l: 'Jobs & Tasks', h: '/jobs' }, { l: 'Agents', h: '/agents' }, { l: 'Payouts', h: '/payouts' }, { l: 'Shifts', h: '/shifts' }, { l: 'Analytics', h: '/analytics' }] },
              { title: 'Operations', links: [{ l: 'SLA Monitoring', h: '/sla' }, { l: 'QA Reviews', h: '/qa' }, { l: 'Escalations', h: '/escalations' }, { l: 'Team Chat', h: '/chat' }, { l: 'Notifications', h: '/notifications' }, { l: 'Billing', h: '/billing' }] },
              { title: 'Platform', links: [{ l: 'Features', h: '#features' }, { l: 'Admin Console', h: '#admin' }, { l: 'How it works', h: '#how-it-works' }, { l: 'Pricing', h: '#pricing' }, { l: 'FAQ', h: '#faq' }] },
              { title: 'Legal', links: [{ l: 'Terms of Service', h: '#' }, { l: 'Privacy Policy', h: '#' }, { l: 'Cookie Policy', h: '#' }, { l: 'Contact', h: 'mailto:hello@workstream.co.ke' }] },
            ].map(({ title, links }) => (
              <div key={title}>
                <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">{title}</div>
                {links.map(({ l, h }) => (
                  <a key={l} href={h} className="mb-2.5 block text-xs text-gray-500 transition-colors hover:text-gray-300">{l}</a>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 sm:flex-row">
            <p className="text-[11px] text-gray-700">© 2026 WorkStream. All rights reserved. Registered in Kenya.</p>
            <div className="flex gap-6">
              {[['Terms', '#'], ['Privacy', '#'], ['Contact', 'mailto:hello@workstream.co.ke']].map(([l, h]) => (
                <a key={l} href={h} className="text-[11px] text-gray-700 transition-colors hover:text-gray-400">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
