"use client";

import { Suspense } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { apiGet, apiPatch, apiPost, extractItems } from "@/lib/api";
import type { CallSession, User } from "@/lib/types";
import { fmtDate, fmtRelative } from "@/lib/format";
import { useCall } from "@/lib/call-context";
import clsx from "clsx";
import { useSearchParams } from "next/navigation";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDuration(s?: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h ${m % 60}m`;
  return `in ${Math.floor(h / 24)}d`;
}

function scheduleGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  if (d < tomorrow) return "Today";
  if (d < new Date(tomorrow.getTime() + 86400000)) return "Tomorrow";
  if (d < nextWeek) return "This week";
  return "Later";
}

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY:    "Daily",
  WEEKDAYS: "Weekdays (Mon–Fri)",
  WEEKLY:   "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY:  "Monthly",
};

// ─── icons ──────────────────────────────────────────────────────────────────

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function CalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

// ─── status pill ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  ONGOING:   "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  INITIATED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  COMPLETED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  MISSED:    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  FAILED:    "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  RINGING:   "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={clsx("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATUS_STYLE[status] ?? "bg-zinc-100 text-zinc-500")}>
      {status.toLowerCase()}
    </span>
  );
}

// ─── Jitsi type ──────────────────────────────────────────────────────────────

// ─── Schedule modal ───────────────────────────────────────────────────────────

function ScheduleModal({
  onClose,
  onScheduled,
}: {
  onClose: () => void;
  onScheduled: (call: CallSession) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState("");
  const [saving, setSaving] = useState(false);

  const minDate = new Date().toISOString().slice(0, 10);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const call = await apiPost<CallSession>("/communication/calls", {
        type: "VIDEO",
        meetingTitle: title.trim() || "Scheduled meeting",
        scheduledAt,
        ...(recurrence ? { recurrenceRule: recurrence } : {}),
      });
      onScheduled(call);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Schedule a meeting</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Meeting title</label>
            <Input
              placeholder="e.g. Weekly standup, Sprint review…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Date</label>
              <input
                type="date"
                required
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ colorScheme: "light" }}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Time</label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ colorScheme: "light" }}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Repeat</label>
            <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="">Does not repeat</option>
              {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Scheduling…" : (
                <>
                  <CalIcon className="h-4 w-4" />
                  Schedule
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── scheduled call card ─────────────────────────────────────────────────────

function ScheduledCard({
  call,
  onStart,
  onCancel,
  onCopyLink,
}: {
  call: CallSession;
  onStart: (call: CallSession) => void;
  onCancel: (id: string) => void;
  onCopyLink: (url: string, password?: string) => void;
}) {
  const [countdown, setCountdown] = useState(() => call.scheduledAt ? timeUntil(call.scheduledAt) : "");

  useEffect(() => {
    if (!call.scheduledAt) return;
    const t = setInterval(() => setCountdown(timeUntil(call.scheduledAt!)), 30000);
    return () => clearInterval(t);
  }, [call.scheduledAt]);

  const isImminent = call.scheduledAt
    ? new Date(call.scheduledAt).getTime() - Date.now() < 15 * 60 * 1000
    : false;

  return (
    <div className={clsx(
      "rounded-xl border p-3.5 transition-colors",
      isImminent
        ? "border-brand-200 bg-brand-50 dark:border-brand-800/60 dark:bg-brand-900/20"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {call.meetingTitle || "Untitled meeting"}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <CalIcon className="h-3.5 w-3.5 flex-shrink-0" />
            {call.scheduledAt ? fmtDate(call.scheduledAt, { dateStyle: "medium", timeStyle: "short" }) : "—"}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          <span className={clsx(
            "rounded-full px-2 py-0.5 text-[10px] font-bold",
            isImminent
              ? "animate-pulse bg-brand-600 text-white"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
          )}>
            {countdown}
          </span>
          {call.recurrenceRule && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              ↻ {RECURRENCE_LABELS[call.recurrenceRule] ?? call.recurrenceRule}
            </span>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onStart(call)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <VideoIcon className="h-3.5 w-3.5" />
          Start now
        </button>
        {call.meetingUrl && (
          <button
            onClick={() => onCopyLink(call.meetingUrl!, call.meetingPassword)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            title="Copy invite (link + password)"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => onCancel(call.id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-500 dark:border-zinc-700 dark:hover:border-red-800 dark:hover:text-red-400"
          title="Cancel meeting"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── history call item ────────────────────────────────────────────────────────

function HistoryItem({ call, active, onRejoin }: {
  call: CallSession;
  active: boolean;
  onRejoin: (call: CallSession) => void;
}) {
  return (
    <div className={clsx(
      "group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors",
      active ? "bg-brand-50 dark:bg-brand-900/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
    )}>
      <div className={clsx(
        "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
        call.status === "ONGOING"
          ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
      )}>
        <VideoIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {call.meetingTitle || call.roomName || "Untitled"}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <StatusPill status={call.status} />
          {(call.durationSec ?? 0) > 0 && (
            <span className="font-mono text-[11px] text-zinc-500">{fmtDuration(call.durationSec)}</span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">
          {fmtDate(call.createdAt, { dateStyle: "medium", timeStyle: "short" })}
          <span className="mx-1 opacity-50">·</span>
          {fmtRelative(call.createdAt)}
        </p>
      </div>
      {call.roomName && (
        <button
          onClick={() => onRejoin(call)}
          className="hidden shrink-0 rounded-md border border-brand-200 px-2 py-1 text-[10px] font-semibold text-brand-600 hover:bg-brand-50 group-hover:inline-flex dark:border-brand-700 dark:text-brand-400"
        >
          Rejoin
        </button>
      )}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

function CallsPage() {
  // Call state lives in context (Shell) so it persists across navigation
  const { activeCall, setActiveCall, initJitsi, endCall, startTimer } = useCall();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [scheduled, setScheduled] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [jitsiReady, setJitsiReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [instantTitle, setInstantTitle] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [copied, setCopied] = useState(false);
  const [me, setMe] = useState<User | null>(null);

  // Capture auto-join params from URL before the component re-renders
  const autoJoinRef = useRef<{ roomName: string; pw?: string } | null>(null);
  useEffect(() => {
    const joinRoom = searchParams.get("join");
    const joinPw = searchParams.get("pw") ?? undefined;
    if (joinRoom && !autoJoinRef.current) {
      autoJoinRef.current = { roomName: joinRoom, pw: joinPw };
      // Clean the URL so a refresh doesn't re-join
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startingRef = useRef(false);

  // ── Load JaaS external API script ──────────────────────────────────────────

  const JAAS_APP_ID = "vpaas-magic-cookie-315e6ce2ff244da49ecbd19f303846d7";

  useEffect(() => {
    if (document.querySelector('script[data-jitsi]')) { setJitsiReady(true); return; }
    const s = document.createElement("script");
    s.src = `https://8x8.vc/${JAAS_APP_ID}/external_api.js`;
    s.async = true;
    s.dataset.jitsi = "1";
    s.onload = () => setJitsiReady(true);
    document.head.appendChild(s);
  }, []);

  // Auto-join when Jitsi is ready and we have pending join params
  useEffect(() => {
    if (!jitsiReady || activeCall || !autoJoinRef.current) return;
    const { roomName, pw } = autoJoinRef.current;
    autoJoinRef.current = null;
    startMeeting({ roomName, password: pw });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jitsiReady]);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, sched] = await Promise.all([
        apiGet<CallSession[]>("/communication/calls"),
        apiGet<CallSession[]>("/communication/calls/scheduled"),
      ]);
      setCalls(extractItems<CallSession>(hist));
      setScheduled(extractItems<CallSession>(sched));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Start instant meeting ──────────────────────────────────────────────────

  const startMeeting = useCallback(async (opts?: { roomName?: string; password?: string }) => {
    if (!jitsiReady || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const session = await apiPost<CallSession>("/communication/calls", {
        type: "VIDEO",
        meetingTitle: instantTitle.trim() || "Workstream meeting",
        ...(opts?.roomName ? { roomName: opts.roomName } : {}),
      });
      setCalls((prev) => [session, ...prev]);
      setActiveCall(session);
      startTimer();
      setInstantTitle("");
      if (session.roomName) {
        const { token } = await apiGet<{ token: string }>(
          `/communication/calls/jaas-token?roomName=${encodeURIComponent(session.roomName)}`,
        );
        setTimeout(() => initJitsi(session.roomName!, token, opts?.password ?? session.meetingPassword), 150);
      }
    } finally {
      setStarting(false);
      startingRef.current = false;
    }
  }, [jitsiReady, instantTitle, initJitsi, setActiveCall, startTimer]);

  // ── Start scheduled meeting ────────────────────────────────────────────────

  const startScheduled = useCallback(async (call: CallSession) => {
    if (!jitsiReady || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      const activated = await apiPost<CallSession>(`/communication/calls/${call.id}/activate`, {});
      setScheduled((prev) => prev.filter((c) => c.id !== call.id));
      setCalls((prev) => [activated, ...prev]);
      setActiveCall(activated);
      startTimer();
      const roomName = activated.roomName ?? call.roomName;
      const password = activated.meetingPassword ?? call.meetingPassword;
      if (roomName) {
        const { token } = await apiGet<{ token: string }>(
          `/communication/calls/jaas-token?roomName=${encodeURIComponent(roomName)}`,
        );
        setTimeout(() => initJitsi(roomName, token, password), 150);
      }
    } finally {
      setStarting(false);
      startingRef.current = false;
    }
  }, [jitsiReady, initJitsi, setActiveCall, startTimer]);

  const cancelScheduled = async (id: string) => {
    try {
      await apiPatch(`/communication/calls/${id}`, { status: "MISSED" });
      setScheduled((prev) => prev.filter((c) => c.id !== id));
    } catch { /**/ }
  };

  const onRejoin = (call: CallSession) =>
    startMeeting({ roomName: call.roomName, password: call.meetingPassword });

  const copyLink = (url: string, password?: string) => {
    const text = password ? `Meeting link: ${url}\nPassword: ${password}` : url;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Scheduled groups ──────────────────────────────────────────────────────

  const scheduledGroups = scheduled.reduce<Record<string, CallSession[]>>((acc, c) => {
    if (!c.scheduledAt) return acc;
    const g = scheduleGroup(c.scheduledAt);
    if (!acc[g]) acc[g] = [];
    acc[g].push(c);
    return acc;
  }, {});
  const GROUP_ORDER = ["Today", "Tomorrow", "This week", "Later"];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside className="flex w-72 flex-shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          {(["upcoming", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                "flex-1 py-3 text-xs font-semibold transition-colors",
                tab === t
                  ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300",
              )}
            >
              {t === "upcoming" ? `Upcoming ${scheduled.length > 0 ? `(${scheduled.length})` : ""}` : "History"}
            </button>
          ))}
          <button
            onClick={loadAll}
            disabled={loading}
            className="px-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-40"
            title="Refresh"
          >
            <RefreshIcon className={clsx("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Action buttons */}
        {!activeCall && (
          <div className="flex gap-2 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <button
              onClick={() => startMeeting()}
              disabled={starting || !jitsiReady}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {starting ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <VideoIcon className="h-3.5 w-3.5" />}
              {!jitsiReady ? "Loading…" : starting ? "Starting…" : "New meeting"}
            </button>
            <button
              onClick={() => setShowSchedule(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              title="Schedule a meeting"
            >
              <CalIcon className="h-3.5 w-3.5" />
              Schedule
            </button>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "upcoming" ? (
            <div className="p-3 space-y-4">
              {loading ? (
                <div className="flex justify-center py-10"><div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-brand-600" /></div>
              ) : scheduled.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <CalIcon className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm font-medium text-zinc-400">No upcoming meetings</p>
                  <button onClick={() => setShowSchedule(true)} className="text-xs text-brand-500 hover:underline">Schedule one</button>
                </div>
              ) : (
                GROUP_ORDER.filter((g) => scheduledGroups[g]?.length).map((group) => (
                  <div key={group}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{group}</p>
                    <div className="space-y-2">
                      {scheduledGroups[group].map((c) => (
                        <ScheduledCard
                          key={c.id}
                          call={c}
                          onStart={startScheduled}
                          onCancel={cancelScheduled}
                          onCopyLink={copyLink}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-0.5 py-2 px-2">
              {loading ? (
                <div className="flex justify-center py-10"><div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-brand-600" /></div>
              ) : calls.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <VideoIcon className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm text-zinc-400">No past meetings</p>
                </div>
              ) : (
                calls.map((c) => (
                  <HistoryItem
                    key={c.id}
                    call={c}
                    active={activeCall?.id === c.id}
                    onRejoin={onRejoin}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <main className="relative flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {!activeCall && (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="w-full max-w-md space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-900/30">
                <VideoIcon className="h-10 w-10 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Video meetings</h1>
                <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                  Start an instant meeting or schedule one for later.
                  Participants join with no downloads required.
                </p>
              </div>

              {/* Instant start form */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Meeting title (optional)</label>
                <Input
                  placeholder="e.g. Quick sync…"
                  value={instantTitle}
                  onChange={(e) => setInstantTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !starting && jitsiReady) startMeeting(); }}
                  className="mb-4"
                />
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={() => startMeeting()} disabled={starting || !jitsiReady}>
                    {starting ? (
                      <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Starting…</>
                    ) : !jitsiReady ? (
                      <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Loading…</>
                    ) : (
                      <><VideoIcon className="h-4 w-4" /> Start now</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowSchedule(true)}>
                    <CalIcon className="h-4 w-4" />
                    Schedule
                  </Button>
                </div>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-2">
                {["HD video", "Screen share", "Schedule & recurring", "No install", "Encrypted", "Free"].map((f) => (
                  <span key={f} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Schedule modal ─────────────────────────────────────────────────── */}
      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onScheduled={(call) => {
            setScheduled((prev) => [...prev, call].sort((a, b) =>
              new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime(),
            ));
            setTab("upcoming");
          }}
        />
      )}
    </div>
  );
}

export default function CallsPageWrapper() {
  return (
    <Suspense>
      <CallsPage />
    </Suspense>
  );
}
