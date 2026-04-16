"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { apiPatch } from "@/lib/api";
import type { CallSession } from "@/lib/types";

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: Record<string, unknown>,
    ) => {
      addEventListener: (event: string, handler: (data?: unknown) => void) => void;
      executeCommand: (command: string, ...args: unknown[]) => void;
      dispose: () => void;
    };
  }
}

export interface CallContextValue {
  activeCall: CallSession | null;
  participants: number;
  callTimer: number;
  setActiveCall: React.Dispatch<React.SetStateAction<CallSession | null>>;
  initJitsi: (roomName: string, token: string, password?: string) => void;
  endCall: () => Promise<void>;
  startTimer: () => void;
}

const CallCtx = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallCtx);
  if (!ctx) throw new Error("useCall must be used inside CallProvider");
  return ctx;
}

const JAAS_APP_ID = "vpaas-magic-cookie-315e6ce2ff244da49ecbd19f303846d7";

/**
 * The Jitsi iframe lives in a div that is mounted directly to document.body
 * — outside the React tree entirely. This means it is NEVER destroyed by
 * navigation: switching to Inbox, Tasks, etc. leaves the call running.
 * Shell positions/shows/hides this div via CSS based on the current route.
 */
function getOrCreateJitsiRoot(): HTMLDivElement {
  let el = document.getElementById("jitsi-root") as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "jitsi-root";
    el.style.cssText = "display:none; position:fixed; z-index:5; background:#0f172a;";
    document.body.appendChild(el);
  }
  return el;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [participants, setParticipants] = useState(0);
  const [callTimer, setCallTimer] = useState(0);

  const jitsiApiRef = useRef<InstanceType<typeof window.JitsiMeetExternalAPI> | null>(null);
  const activeCallRef = useRef<CallSession | null>(null);
  const callStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endingRef = useRef(false);
  const mountElRef = useRef<HTMLDivElement | null>(null);

  // Create the persistent body-mounted div once on client
  useEffect(() => {
    mountElRef.current = getOrCreateJitsiRoot();
  }, []);

  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  const startTimer = useCallback(() => {
    callStartRef.current = Date.now();
    setCallTimer(0);
    timerRef.current = setInterval(
      () => setCallTimer(Math.floor((Date.now() - callStartRef.current) / 1000)),
      1000,
    );
  }, []);

  const stopTimer = (): number => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    return Math.floor((Date.now() - callStartRef.current) / 1000);
  };

  const endCall = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    const target = activeCallRef.current;
    const durationSec = stopTimer();
    if (jitsiApiRef.current) {
      try { jitsiApiRef.current.dispose(); } catch { /**/ }
      jitsiApiRef.current = null;
    }
    // Hide the body-mounted div
    const el = document.getElementById("jitsi-root");
    if (el) el.style.display = "none";

    setActiveCall(null);
    setParticipants(0);
    setCallTimer(0);
    if (target) {
      try {
        await apiPatch(`/communication/calls/${target.id}`, { status: "COMPLETED", durationSec });
      } catch { /**/ }
    }
    endingRef.current = false;
  }, []);

  const initJitsi = useCallback((roomName: string, token: string, password?: string) => {
    const mountEl = mountElRef.current ?? getOrCreateJitsiRoot();
    if (!window.JitsiMeetExternalAPI) return;

    if (jitsiApiRef.current) {
      try { jitsiApiRef.current.dispose(); } catch { /**/ }
      jitsiApiRef.current = null;
    }
    mountEl.innerHTML = "";

    const api = new window.JitsiMeetExternalAPI("8x8.vc", {
      roomName: `${JAAS_APP_ID}/${roomName}`,
      jwt: token,
      parentNode: mountEl,
      width: "100%",
      height: "100%",
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        enableNoisyMicDetection: false,
        enableNoAudioDetection: false,
        prejoinPageEnabled: false,
        disableLobbyMode: true,
        enableLobbyChat: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: "#0f172a",
        TOOLBAR_BUTTONS: [
          "microphone", "camera", "desktop", "fullscreen",
          "fodeviceselection", "hangup", "profile", "chat",
          "recording", "raisehand", "videoquality", "filmstrip",
          "tileview", "videobackgroundblur", "settings",
        ],
      },
    });

    // Patch iframe permissions — ensure camera/microphone/display-capture are allowed
    requestAnimationFrame(() => {
      const iframe = mountEl.querySelector("iframe");
      if (iframe) {
        iframe.setAttribute("allow", "camera *; microphone *; display-capture *; autoplay *; clipboard-write *; fullscreen *");
        iframe.setAttribute("allowfullscreen", "true");
      }
    });

    api.addEventListener("participantJoined", () => setParticipants((p) => p + 1));
    api.addEventListener("participantLeft", () => setParticipants((p) => Math.max(1, p - 1)));
    api.addEventListener("videoConferenceJoined", () => {
      if (password) api.executeCommand("password", password);
    });
    api.addEventListener("videoConferenceLeft", () => endCall());
    api.addEventListener("readyToClose", () => endCall());

    jitsiApiRef.current = api;
    setParticipants(1);
  }, [endCall]);

  return (
    <CallCtx.Provider value={{ activeCall, participants, callTimer, setActiveCall, initJitsi, endCall, startTimer }}>
      {children}
    </CallCtx.Provider>
  );
}
