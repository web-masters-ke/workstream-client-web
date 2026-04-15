"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useTheme } from "@/lib/theme";
import { apiGet, clearAuth, WORKSPACE_KEY } from "@/lib/api";
import { NotificationsProvider, useNotifications } from "@/lib/notifications";
import { PresenceProvider, usePresence, type MyPresenceStatus } from "@/lib/presence";
import { CallProvider, useCall } from "@/lib/call-context";
import { fmtRelative } from "@/lib/format";
import type { Workspace } from "@/lib/types";

// ─── Icons ────────────────────────────────────────────────────────────────────

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={d} />
    </svg>
  );
}

const icons: Record<string, string> = {
  overview:       "M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9",
  jobs:           "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  tasks:          "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  escalations:    "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  qa:             "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  shifts:         "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  agents:         "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8 2v6m3-3h-6",
  team:           "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8m14 2a3 3 0 00-3-3",
  chat:           "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  calls:          "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  notifications:  "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  reports:        "M16 8v8m-4-5v5m-4-2v2M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  billing:        "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  wallet:         "M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6zm16 5h-3a2 2 0 000 4h3v-4z",
  marketplace:    "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
  mybids:         "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  mylistings:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  workspaces:     "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  settings:       "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  profile:        "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  help:           "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

function NavIcon({ href }: { href: string }) {
  const KEY_OVERRIDES: Record<string, string> = {
    "/marketplace/my-listings": "mylistings",
    "/marketplace/my-bids":     "mybids",
  };
  const key = KEY_OVERRIDES[href]
    ?? (href === "/dashboard" ? "overview" : href.replace("/", "").split("/")[0]);
  const d = icons[key] ?? icons.overview;
  return <Icon d={d} size={15} />;
}

// ─── Nav config ───────────────────────────────────────────────────────────────

interface NavItem { href: string; label: string; group?: string; roles?: string[] }

// roles: which user roles can see this item. Omit = everyone.
// AGENT = field worker. BUSINESS roles = OWNER/ADMIN/SUPERVISOR/MEMBER/BILLING/VIEWER.
const NAV: NavItem[] = [
  { href: "/dashboard",     label: "Overview",      group: "Main",          roles: ["OWNER","ADMIN","SUPERVISOR","MEMBER","BILLING","VIEWER"] },
  { href: "/jobs",          label: "Jobs",          group: "Operations",    roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/tasks",         label: "Tasks",         group: "Operations" },
  { href: "/escalations",   label: "Escalations",   group: "Operations",    roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/qa",            label: "Quality",       group: "Operations",    roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/shifts",        label: "Shifts",        group: "Operations",    roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/agents",               label: "Agents",        group: "People",        roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/team",                 label: "Team",          group: "People",        roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/marketplace",          label: "Free Agents",   group: "People",        roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/marketplace/my-listings", label: "My Listings", group: "People",       roles: ["OWNER","ADMIN","SUPERVISOR"] },
  { href: "/chat",          label: "Inbox",         group: "Communication" },
  { href: "/calls",         label: "Calls",         group: "Communication" },
  { href: "/notifications", label: "Notifications", group: "Communication" },
  { href: "/wallet",               label: "Wallet",        group: "Earnings",      roles: ["AGENT"] },
  { href: "/marketplace",          label: "Marketplace",   group: "Earnings",      roles: ["AGENT"] },
  { href: "/marketplace/my-bids",  label: "My Bids",       group: "Earnings",      roles: ["AGENT"] },
  { href: "/reports",       label: "Reports",       group: "Insights",      roles: ["OWNER","ADMIN","SUPERVISOR","BILLING","VIEWER"] },
  { href: "/billing",       label: "Billing",       group: "Insights",      roles: ["OWNER","ADMIN","BILLING"] },
  { href: "/workspaces",    label: "Workspaces",    group: "Account",       roles: ["OWNER","ADMIN"] },
  { href: "/settings",      label: "Settings",      group: "Account",       roles: ["OWNER","ADMIN"] },
  { href: "/profile",       label: "Profile",       group: "Account" },
  { href: "/help",          label: "Help",          group: "Account" },
];

function getNavForRole(role: string): NavItem[] {
  // BUSINESS is the default org-owner role from registration — treat as OWNER for nav filtering
  const effectiveRole = role === "BUSINESS" ? "OWNER" : role;
  return NAV.filter((n) => !n.roles || n.roles.includes(effectiveRole));
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
    >
      {theme === "dark" ? (
        /* Sun */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ─── Notification bell ────────────────────────────────────────────────────────

function NotificationBell() {
  const { items, unread, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-80 rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Notifications</span>
            <button onClick={markAllRead} className="text-[11px] text-brand-600 hover:underline">Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-400">All caught up</div>
            ) : (
              items.slice(0, 20).map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/notifications"}
                  onClick={() => markRead(n.id)}
                  className={clsx(
                    "block border-b border-zinc-50 px-3 py-2.5 text-xs last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60",
                    !n.read && "bg-brand-50/40 dark:bg-brand-900/10",
                  )}
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">{n.title}</div>
                  {n.body && <div className="mt-0.5 line-clamp-1 text-zinc-400">{n.body}</div>}
                  <div className="mt-1 text-[10px] text-zinc-400">{fmtRelative(n.createdAt)}</div>
                </Link>
              ))
            )}
          </div>
          <div className="border-t border-zinc-100 px-3 py-2 text-center dark:border-zinc-800">
            <Link href="/notifications" className="text-[11px] font-medium text-brand-600 hover:underline">View all</Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Presence dot ────────────────────────────────────────────────────────────

const PRESENCE_CONFIG: Record<MyPresenceStatus, { color: string; label: string }> = {
  ONLINE:    { color: "bg-green-500",  label: "Online" },
  AWAY:      { color: "bg-amber-400",  label: "Away" },
  INVISIBLE: { color: "bg-zinc-400",   label: "Appear offline" },
};

function PresenceDot({ status, className }: { status: MyPresenceStatus; className?: string }) {
  const cfg = PRESENCE_CONFIG[status] ?? PRESENCE_CONFIG.ONLINE;
  return (
    <span
      className={clsx(
        "block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900",
        cfg.color,
        className,
      )}
    />
  );
}

// ─── User avatar dropdown ─────────────────────────────────────────────────────

function UserMenu({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [initials, setInitials] = useState("W");
  const { myStatus, setMyStatus } = usePresence();

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const u = JSON.parse(localStorage.getItem("ws-user") ?? "{}");
        if (u?.name) setInitials(u.name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase());
        else if (u?.email) setInitials(u.email[0].toUpperCase());
      } catch { /* noop */ }
    }
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleStatus = (s: MyPresenceStatus) => {
    setMyStatus(s);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Avatar button with presence dot */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white hover:opacity-90 transition-opacity"
      >
        {initials}
        <span className="absolute -bottom-0.5 -right-0.5">
          <PresenceDot status={myStatus} />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <Link href="/profile" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800">Profile</Link>
          <Link href="/settings" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800">Settings</Link>

          {/* Status section */}
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Status</p>
          {(["ONLINE", "AWAY", "INVISIBLE"] as MyPresenceStatus[]).map((s) => {
            const cfg = PRESENCE_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => handleStatus(s)}
                className={clsx(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                  myStatus === s
                    ? "bg-zinc-50 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                <span className={clsx("h-2.5 w-2.5 rounded-full", cfg.color)} />
                {cfg.label}
                {myStatus === s && (
                  <svg className="ml-auto h-3.5 w-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          <button onClick={onLogout} className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30">Sign out</button>
        </div>
      )}
    </div>
  );
}

// ─── Call persistence helpers ─────────────────────────────────────────────────

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Positions the body-mounted Jitsi div and renders the call bar / floating
 * banner depending on whether the user is on the /calls page or elsewhere.
 * This component must live inside ShellInner so it can read usePathname().
 */
function LiveCallOverlay() {
  const { activeCall, participants, callTimer, endCall } = useCall();
  const pathname = usePathname();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const isCallsPage = pathname === "/calls";

  // Shell sidebar = 240px (w-60), calls-page sidebar = 288px (w-72)
  const SHELL_SIDEBAR = 240;
  const CALLS_SIDEBAR = 288;
  const HEADER_H = 56;
  const CALLBAR_H = 57;

  // Position / show-hide the body-mounted Jitsi div
  useEffect(() => {
    const el = document.getElementById("jitsi-root");
    if (!el) return;

    if (activeCall && isCallsPage) {
      // Full-size in the calls-page right panel, below the call bar
      el.style.cssText = `
        position: fixed;
        top: ${HEADER_H + CALLBAR_H}px;
        left: ${SHELL_SIDEBAR + CALLS_SIDEBAR}px;
        right: 0;
        bottom: 0;
        z-index: 5;
        display: block;
        background: #0f172a;
      `;
    } else {
      // Hide but keep iframe alive → audio continues on other pages
      el.style.display = "none";
    }
  }, [activeCall, isCallsPage]);

  const copyInvite = () => {
    if (!activeCall?.meetingUrl) return;
    const text = activeCall.meetingPassword
      ? `Meeting link: ${activeCall.meetingUrl}\nPassword: ${activeCall.meetingPassword}`
      : activeCall.meetingUrl;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!activeCall) return null;

  if (isCallsPage) {
    // ── Persistent call bar on the calls page ───────────────────────────────
    return (
      <div
        className="fixed z-20 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900"
        style={{ top: HEADER_H, left: SHELL_SIDEBAR + CALLS_SIDEBAR, right: 0, height: CALLBAR_H }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {activeCall.meetingTitle || "Workstream meeting"}
          </span>
          <span className="font-mono text-xs tabular-nums text-zinc-400">{fmtDuration(callTimer)}</span>
          {participants > 0 && (
            <span className="text-xs text-zinc-400">{participants} in call</span>
          )}
          {activeCall.meetingPassword && (
            <span className="hidden rounded-md border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 sm:inline">
              pw: {activeCall.meetingPassword}
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {activeCall.meetingUrl && (
            <button
              onClick={copyInvite}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              {copied ? "Copied!" : "Copy invite"}
            </button>
          )}
          <button
            onClick={endCall}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            End call
          </button>
        </div>
      </div>
    );
  }

  // ── Floating "you're in a call" bar on all other pages ────────────────────
  return (
    <div
      className="fixed z-50 flex items-center justify-between gap-3 border-t border-zinc-200 bg-white px-4 py-2.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      style={{ bottom: 0, left: SHELL_SIDEBAR, right: 0 }}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          Live: {activeCall.meetingTitle || "Workstream meeting"}
        </span>
        <span className="font-mono text-xs tabular-nums text-zinc-500">{fmtDuration(callTimer)}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/calls")}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Return to meeting
        </button>
        <button
          onClick={endCall}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          End
        </button>
      </div>
    </div>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("OWNER");

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("ws-user") ?? "{}");
      if (u?.role) setUserRole(u.role);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_KEY) : null;
    if (saved) setWorkspaceId(saved);

    (async () => {
      try {
        const data = await apiGet<Workspace[]>("/workspaces");
        if (Array.isArray(data) && data.length > 0) {
          setWorkspaces(data);
          if (!saved && typeof window !== "undefined") {
            const firstId = data[0].id;
            setWorkspaceId(firstId);
            localStorage.setItem(WORKSPACE_KEY, firstId);
          }
        }
      } catch { /* no workspaces yet */ }
    })();
  }, []);

  const handleWorkspaceChange = (id: string) => {
    setWorkspaceId(id);
    if (typeof window !== "undefined") localStorage.setItem(WORKSPACE_KEY, id);
  };

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const visibleNav = getNavForRole(userRole);
  const groups = Array.from(new Set(visibleNav.map((n) => n.group ?? "Main")));

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">W</div>
        <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">WorkStream</span>
      </div>

      {/* Workspace picker */}
      {workspaces.length > 0 && (
        <div className="mx-3 mb-4">
          <select
            value={workspaceId}
            onChange={(e) => handleWorkspaceChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g} className="mb-4">
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{g}</div>
            <div className="space-y-0.5">
              {visibleNav.filter((n) => (n.group ?? "Main") === g).map((item) => {
                const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all",
                      active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                    )}
                  >
                    <span className={clsx("transition-colors", active ? "text-brand-500 dark:text-brand-400" : "text-zinc-400 dark:text-zinc-500")}>
                      <NavIcon href={item.href} />
                    </span>
                    {item.label}
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-500 dark:bg-brand-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-white dark:bg-zinc-900 shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top navigation bar */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
              aria-label="Open menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Breadcrumb / current page */}
            <span className="hidden text-sm font-medium text-zinc-600 dark:text-zinc-300 sm:block">
              {visibleNav.find((n) => (n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href)))?.label ?? "WorkStream"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <ThemeToggle />
            <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
            <UserMenu onLogout={handleLogout} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <LiveCallOverlay />
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <CallProvider>
      <NotificationsProvider>
        <ShellInnerWithPresence>{children}</ShellInnerWithPresence>
      </NotificationsProvider>
    </CallProvider>
  );
}

// Reads myUserId from localStorage so PresenceProvider has it immediately
function ShellInnerWithPresence({ children }: { children: ReactNode }) {
  const [myUserId, setMyUserId] = useState<string | undefined>(undefined);
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("ws-user") ?? "{}");
      if (u?.id) setMyUserId(u.id);
    } catch { /* noop */ }
  }, []);
  return (
    <PresenceProvider myUserId={myUserId}>
      <ShellInner>{children}</ShellInner>
    </PresenceProvider>
  );
}
