"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Notification } from "./types";
import { apiGet } from "./api";
import { onRealtime } from "./socket";

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
        const res = await apiGet<Notification[]>("/notifications");
        if (!cancelled && Array.isArray(res)) setItems(res);
      } catch {
        // No mock fallback — start with empty list; real-time events will populate it
      }
    })();
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
