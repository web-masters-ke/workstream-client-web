"use client";

import { io, Socket } from "socket.io-client";
import { getAuthToken } from "./api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const token = getAuthToken();
  socket = io(`${WS_URL}/notifications`, {
    transports: ["websocket"],
    auth: token ? { token } : undefined,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
  });
  // Swallow connection errors so the UI never crashes when backend is absent
  socket.on("connect_error", () => {
    /* silent */
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export type RealtimeEvent =
  | { type: "task.created"; payload: { taskId: string; jobId: string } }
  | { type: "task.assigned"; payload: { taskId: string; agentId: string } }
  | { type: "task.status_changed"; payload: { taskId: string; status: string } }
  | { type: "task.message"; payload: { taskId: string; messageId: string; body?: string; senderName?: string } }
  | { type: "sla.breach"; payload: { taskId: string; jobId?: string } }
  | { type: "agent.presence"; payload: { agentId: string; status: string } };

export function onRealtime(handler: (event: RealtimeEvent) => void): () => void {
  const s = getSocket();
  const fn = (event: RealtimeEvent) => handler(event);
  s.on("event", fn);
  return () => {
    s.off("event", fn);
  };
}
