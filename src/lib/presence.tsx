"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSocket, onRealtime, type PresenceStatus } from "./socket";

export type MyPresenceStatus = "ONLINE" | "AWAY" | "INVISIBLE";

interface PresenceContextValue {
  /** Map of userId → their current visible status */
  presence: Record<string, PresenceStatus>;
  /** The current user's own chosen status (including INVISIBLE) */
  myStatus: MyPresenceStatus;
  /** Change the current user's status; broadcasts to all workspace peers */
  setMyStatus: (s: MyPresenceStatus) => void;
  /** Returns true if a user is ONLINE or AWAY */
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  presence: {},
  myStatus: "ONLINE",
  setMyStatus: () => {},
  isOnline: () => false,
});

export function PresenceProvider({
  children,
  myUserId,
}: {
  children: ReactNode;
  myUserId?: string;
}) {
  const [presence, setPresence] = useState<Record<string, PresenceStatus>>({});
  const [myStatus, setMyStatusState] = useState<MyPresenceStatus>("ONLINE");
  // Avoid re-registering the listener when myUserId changes
  const myUserIdRef = useRef(myUserId);
  useEffect(() => { myUserIdRef.current = myUserId; }, [myUserId]);

  // Subscribe to presence events from the socket
  useEffect(() => {
    const off = onRealtime((ev) => {
      if (ev.type === "user.presence") {
        const { userId, status } = ev.payload;
        setPresence((prev) => ({ ...prev, [userId]: status }));
      } else if (ev.type === "presence.snapshot") {
        const { users } = ev.payload;
        const map: Record<string, PresenceStatus> = {};
        for (const u of users) {
          map[u.userId] = (u.status as PresenceStatus) ?? "OFFLINE";
        }
        setPresence((prev) => ({ ...prev, ...map }));
      }
    });
    return off;
  }, []);

  const setMyStatus = useCallback((status: MyPresenceStatus) => {
    setMyStatusState(status);
    const socket = getSocket();
    socket.emit("set_presence", { status });
    // Optimistically update our own entry so it's instant in our UI
    const uid = myUserIdRef.current;
    if (uid) {
      const effective: PresenceStatus =
        status === "INVISIBLE" ? "OFFLINE" : (status as PresenceStatus);
      setPresence((prev) => ({ ...prev, [uid]: effective }));
    }
  }, []);

  const isOnline = useCallback(
    (userId: string) =>
      presence[userId] === "ONLINE" || presence[userId] === "AWAY",
    [presence],
  );

  return (
    <PresenceContext.Provider value={{ presence, myStatus, setMyStatus, isOnline }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
