"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, LoadingState, PageHeader } from "@/components/ui";
import { useNotifications } from "@/lib/notifications";
import { apiGet, apiPatch } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import type { Notification } from "@/lib/types";

type Tab = "ALL" | "UNREAD" | "TASK" | "PAYMENT" | "SYSTEM";

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const groups: Record<string, Notification[]> = { Today: [], Yesterday: [], "This week": [], Older: [] };
  items.forEach((n) => {
    const d = new Date(n.createdAt);
    if (d.toDateString() === today) groups["Today"].push(n);
    else if (d.toDateString() === yesterday) groups["Yesterday"].push(n);
    else if (d >= weekAgo) groups["This week"].push(n);
    else groups["Older"].push(n);
  });
  return Object.entries(groups)
    .filter(([, arr]) => arr.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function typeIcon(type: string | undefined) {
  const t = type ?? "";
  if (t.includes("TASK") || t.includes("task") || t.includes("Task") || t.includes("Escalat") || t.includes("escalat")) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    );
  }
  if (t.includes("PAY") || t.includes("WALLET") || t.includes("INVOICE") || t.includes("pay") || t.includes("wallet")) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  }
  if (t.includes("MESSAGE") || t.includes("CHAT") || t.includes("message") || t.includes("chat")) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function typeCategory(type: string | undefined): "TASK" | "PAYMENT" | "SYSTEM" | "OTHER" {
  const t = (type ?? "").toUpperCase();
  if (t.includes("TASK") || t.includes("MESSAGE") || t.includes("CHAT")) return "TASK";
  if (t.includes("PAY") || t.includes("WALLET") || t.includes("INVOICE")) return "PAYMENT";
  if (t.includes("SYSTEM") || t.includes("ALERT")) return "SYSTEM";
  return "OTHER";
}

function tabEmptyMsg(tab: Tab): string {
  switch (tab) {
    case "UNREAD": return "You're all caught up — no unread notifications.";
    case "TASK": return "No task or message notifications yet.";
    case "PAYMENT": return "No payment notifications yet.";
    case "SYSTEM": return "No system alerts.";
    default: return "No notifications yet.";
  }
}

export default function NotificationsPage() {
  const { items: ctxItems, unread, markRead, markAllRead, push } = useNotifications();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tab, setTab] = useState<Tab>("ALL");

  // Merge context items (real-time) with API items
  const merged = useMemo(() => {
    const ids = new Set(items.map((n) => n.id));
    const rt = ctxItems.filter((n) => !ids.has(n.id));
    return [...rt, ...items];
  }, [items, ctxItems]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const mapN = (n: any): Notification => ({
          ...n,
          type: n.type ?? n.channel ?? n.title ?? "",
          read: n.read ?? (n.readAt != null),
        });
        // Always use JWT-auth endpoint so we get the right user's notifications
        const data = await apiGet<{ items: Notification[]; total: number } | Notification[]>(
          "/notifications?page=1&limit=50",
        );
        let res: Notification[] = [];
        if (Array.isArray(data)) {
          res = data.map(mapN);
          setHasMore(false);
        } else if (data && "items" in data) {
          res = data.items.map(mapN);
          setHasMore((data as any).total > 50);
        }
        if (!cancelled) setItems(res);
      } catch {
        // fall back to context items so real-time notifications still show
        if (!cancelled) setItems(ctxItems);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await apiGet<{ items: Notification[]; total: number }>(
        `/notifications?page=${nextPage}&limit=50`,
      );
      const mapN = (n: any): Notification => ({
        ...n,
        type: n.type ?? n.channel ?? n.title ?? "",
        read: n.read ?? (n.readAt != null),
      });
      setItems((prev) => [...prev, ...data.items.map(mapN)]);
      setPage(nextPage);
      setHasMore((page + 1) * 50 < data.total);
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  };

  const handleRead = async (n: Notification) => {
    markRead(n.id);
    setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    try { await apiPatch(`/notifications/${n.id}/read`, {}); } catch { /* stub */ }
  };

  const handleMarkAllRead = async () => {
    markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const userId = (JSON.parse(localStorage.getItem("ws-user") ?? "{}") as any).id ?? "";
      if (userId) await apiPatch(`/notifications/user/${userId}/read-all`, {});
    } catch { /* best-effort */ }
  };

  const tabItems = useMemo(() => {
    return merged.filter((n) => {
      if (tab === "UNREAD") return !n.read;
      if (tab === "TASK") return typeCategory(n.type) === "TASK";
      if (tab === "PAYMENT") return typeCategory(n.type) === "PAYMENT";
      if (tab === "SYSTEM") return typeCategory(n.type) === "SYSTEM";
      return true;
    });
  }, [merged, tab]);

  const grouped = useMemo(() => groupByDate(tabItems), [tabItems]);
  const unreadCount = merged.filter((n) => !n.read).length;

  const TABS: { label: string; value: Tab }[] = [
    { label: "All", value: "ALL" },
    { label: "Unread", value: "UNREAD" },
    { label: "Tasks", value: "TASK" },
    { label: "Payments", value: "PAYMENT" },
    { label: "System", value: "SYSTEM" },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        action={
          <Button size="sm" variant="outline" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            Mark all read
          </Button>
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              tab === value
                ? "border-b-2 border-brand-600 text-brand-600 dark:text-brand-400"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {label}
            {value === "UNREAD" && unreadCount > 0 && (
              <Badge tone="danger">{unreadCount}</Badge>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Loading notifications..." />
      ) : tabItems.length === 0 ? (
        <EmptyState title="No notifications" message={tabEmptyMsg(tab)} />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, items: group }) => (
            <div key={label}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</p>
              <div className="space-y-1.5">
                {group.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link || "#"}
                    onClick={() => handleRead(n)}
                    className={`block rounded-xl border p-3.5 transition hover:border-brand-300 dark:hover:border-brand-600 ${
                      !n.read
                        ? "border-brand-200 bg-brand-50/40 dark:border-brand-900/70 dark:bg-brand-900/10"
                        : "border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex-shrink-0 text-zinc-400 ${!n.read ? "text-brand-500 dark:text-brand-400" : ""}`}>
                        {typeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {!n.read && <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />}
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{n.title}</p>
                            <Badge tone="default">{n.type}</Badge>
                          </div>
                          <span className="shrink-0 text-[10px] text-zinc-400">{fmtRelative(n.createdAt)}</span>
                        </div>
                        {n.body && (
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{n.body}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
