"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Notification } from "./types";
import { apiGet } from "./api";
import { onRealtime, subscribeToUserRoom } from "./socket";

interface NotificationsCtx {
  items: Notification[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  push: (n: Notification) => void;
}

const Ctx = createContext<NotificationsCtx | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Backend returns { items: [...], total: N } inside the data envelope
        const res = await apiGet<{ items: unknown[]; total: number } | unknown[]>("/notifications");
        if (cancelled) return;
        const raw: unknown[] = Array.isArray(res) ? res : (res as any)?.items ?? [];
        const mapped: Notification[] = raw.map((n: any) => ({
          id: n.id ?? "",
          type: n.type ?? n.channel ?? "",
          title: n.title ?? "",
          body: n.body ?? undefined,
          link: n.link ?? undefined,
          read: n.read ?? (n.readAt != null),
          createdAt: n.createdAt ?? new Date().toISOString(),
        }));
        setItems(mapped);
      } catch {
        // No mock fallback — start with empty list; real-time events will populate it
      }
    })();
    // Subscribe to user-specific room so real-time events arrive
    try {
      const u = JSON.parse(localStorage.getItem("ws-user") ?? "{}");
      if (u?.id) subscribeToUserRoom(u.id);
    } catch { /* noop */ }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const off = onRealtime((event) => {
      if (event.type === "task.status_changed") {
        setItems((prev) => [
          {
            id: `rt-${Date.now()}`,
            type: "TASK_STATUS",
            title: `Task ${event.payload.taskId} → ${event.payload.status}`,
            link: `/tasks/${event.payload.taskId}`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else if (event.type === "task.message") {
        setItems((prev) => [
          {
            id: `rt-${Date.now()}`,
            type: "NEW_MESSAGE",
            title: "New message",
            link: `/tasks/${event.payload.taskId}`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    });
    return off;
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);
  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);
  const push = useCallback((n: Notification) => {
    setItems((prev) => [n, ...prev]);
  }, []);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  return <Ctx.Provider value={{ items, unread, markRead, markAllRead, push }}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      items: [],
      unread: 0,
      markRead: () => {},
      markAllRead: () => {},
      push: () => {},
    };
  }
  return ctx;
}
