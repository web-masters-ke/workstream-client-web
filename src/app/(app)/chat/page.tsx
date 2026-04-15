"use client";

import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, EmptyState, ErrorState, Input, LoadingState, PageHeader } from "@/components/ui";
import { apiGet, apiPost, getAuthToken, extractItems } from "@/lib/api";
import type { ChatMessage, Conversation, Member } from "@/lib/types";
import { fmtRelative } from "@/lib/format";

// Matches the JaaS room name from a JaaS or legacy meet.jit.si URL
// JaaS:   https://8x8.vc/<appId>/<roomName>
// Legacy: https://meet.jit.si/<roomName>
const JAAS_RE = /https:\/\/8x8\.vc\/[^/\s]+\/([^\s/?#]+)/;
const JITSI_RE = /https:\/\/meet\.jit\.si\/([^\s/?#]+)/;
const PW_RE = /Password[:\s]+([^\s\n]+)/i;

function MessageBody({ text, isMe }: { text: string; isMe: boolean }) {
  const router = useRouter();
  const URL_RE = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(URL_RE);

  // Detect meeting invite: extract room + password from full message text
  const roomMatch = text.match(JAAS_RE) || text.match(JITSI_RE);
  const meetingRoom = roomMatch?.[1] ?? null;
  const meetingPw = text.match(PW_RE)?.[1] ?? null;

  const handleJoin = () => {
    const p = new URLSearchParams();
    p.set("join", meetingRoom!);
    if (meetingPw) p.set("pw", meetingPw);
    router.push(`/calls?${p.toString()}`);
  };

  return (
    <div>
      <div>
        {parts.map((part, i) =>
          URL_RE.test(part) ? (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={isMe ? "underline text-white/90 hover:text-white" : "underline text-brand-600 hover:text-brand-700 dark:text-brand-400"}
            >
              {part}
            </a>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </div>
      {meetingRoom && (
        <button
          onClick={handleJoin}
          className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Join call in Workstream
        </button>
      )}
    </div>
  );
}
import { onRealtime } from "@/lib/socket";
import { usePresence } from "@/lib/presence";
import clsx from "clsx";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

// ─── emoji data ────────────────────────────────────────────────────────────
const EMOJI_GROUPS = [
  {
    label: "Smileys",
    emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","😉","😍","🥰","😘","😋","😛","😜","🤪","😎","🤩","🥳","😏","😒","😔","😢","😭","😤","😠","🤬","🥺","😱","🤗","🤔","🙄","😬","🤐","😴","🤢","🤮","🤧","🤒","🤕"],
  },
  {
    label: "Hands",
    emojis: ["👍","👎","👋","✋","🤚","🖐","🖖","👌","🤌","✌️","🤞","🤙","👈","👉","👆","👇","☝️","👏","🙌","🙏","💪","✍️","🤝"],
  },
  {
    label: "Objects",
    emojis: ["❤️","🔥","✅","❌","⭐","💫","🎯","🎉","🎊","🏆","🥇","💡","📌","🚀","💎","🌟","⚡","🌈","🎶","🎵","🎤","💯","🧠","💬","📎","🔗","💻","📱","🕐","📅"],
  },
];

// ─── helpers ────────────────────────────────────────────────────────────────
function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const letters = name.trim().split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div className={`inline-flex flex-shrink-0 items-center justify-center rounded-full bg-brand-600 font-medium text-white ${sz}`}>
      {letters || "?"}
    </div>
  );
}

function fmtTimer(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// ─── emoji picker ────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-14 right-12 z-50 w-72 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* Tabs */}
      <div className="flex border-b border-zinc-100 px-1 pt-1 dark:border-zinc-800">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => setTab(i)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              tab === i ? "border-b-2 border-brand-500 text-brand-600" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      {/* Grid */}
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {EMOJI_GROUPS[tab].emojis.map((e) => (
          <button
            key={e}
            onClick={() => onSelect(e)}
            className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── new conversation modal ────────────────────────────────────────────────
function NewConversationModal({
  members, onClose, onCreate, defaultMode = "dm",
}: {
  members: Member[];
  onClose: () => void;
  onCreate: (conv: Conversation) => void;
  defaultMode?: "dm" | "group";
}) {
  const [mode, setMode] = useState<"dm" | "group">(defaultMode);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = members.filter(
    (m) =>
      !selected.find((s) => s.id === m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())),
  );

  const canCreate = mode === "dm" ? selected.length === 1 : selected.length >= 2 && groupTitle.trim().length > 0;

  const create = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const isGroup = mode === "group";
      const conv = await apiPost<Conversation>("/communication/conversations", {
        participantUserIds: selected.map((m) => m.userId),
        title: isGroup ? groupTitle.trim() : selected[0].name,
        type: isGroup ? "GROUP" : "DIRECT",
      });
      onCreate({ ...conv, type: isGroup ? "GROUP" : "DIRECT" });
      onClose();
    } catch {
      const isGroup = mode === "group";
      const mock: Conversation = {
        id: `conv-${Date.now()}`,
        title: isGroup ? groupTitle.trim() : selected[0].name,
        type: isGroup ? "GROUP" : "DIRECT",
        participants: selected.map((m) => ({ id: m.userId, name: m.name })),
        unread: 0,
      };
      onCreate(mock);
      onClose();
    } finally { setCreating(false); }
  };

  const toggleMember = (m: Member) => {
    const already = selected.find((s) => s.id === m.id);
    if (already) {
      setSelected((prev) => prev.filter((s) => s.id !== m.id));
    } else if (mode === "dm") {
      // DM: only one person
      setSelected([m]);
    } else {
      setSelected((prev) => [...prev, m]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">New conversation</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">✕</button>
        </div>

        {/* Mode toggle */}
        <div className="mb-4 flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          {(["dm", "group"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSelected([]); }}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                mode === m
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
              )}
            >
              {m === "dm" ? (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Direct message
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  Group chat
                </>
              )}
            </button>
          ))}
        </div>

        {/* Group title */}
        {mode === "group" && (
          <Input
            placeholder="Group name (e.g. Design team, Sprint 12…)"
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            className="mb-3"
            autoFocus
          />
        )}

        {/* Member search */}
        <Input
          placeholder={mode === "dm" ? "Search team member…" : "Add members…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
          autoFocus={mode === "dm"}
        />

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {selected.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {m.name}
                <button onClick={() => setSelected((prev) => prev.filter((s) => s.id !== m.id))} className="hover:text-red-500">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Member list */}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-400">{search ? "No users found." : "No team members available."}</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMember(m)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Avatar name={m.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{m.name}</p>
                  <p className="text-[10px] text-zinc-400">{m.email}</p>
                </div>
                <span className="text-[10px] text-zinc-300 dark:text-zinc-600 capitalize">{m.role?.toLowerCase()}</span>
              </button>
            ))
          )}
        </div>

        <p className="mt-2 text-[10px] text-zinc-400">
          {mode === "dm"
            ? "Select one person to start a private conversation."
            : `${selected.length} selected — group needs at least 2 members.`}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={create} disabled={!canCreate || creating}>
            {creating ? "Creating…" : mode === "dm" ? "Open DM" : "Create group"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── voice note player ────────────────────────────────────────────────────
function VoicePlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 dark:bg-brand-900/30">
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => setProgress(audioRef.current ? (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100 : 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white"
      >
        {playing ? (
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div className="flex-1">
        <div className="h-1 w-full rounded-full bg-brand-200 dark:bg-brand-800">
          <div className="h-1 rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-0.5 text-[10px] text-brand-500">
          {duration > 0 && isFinite(duration) ? fmtTimer(Math.ceil(duration)) : "🎤 Voice note"}
        </p>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [newModalMode, setNewModalMode] = useState<"dm" | "group" | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── voice recording state ────────────────────────────────────────────────
  type VoiceState = "idle" | "recording" | "preview";
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── file attachment state ────────────────────────────────────────────────
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("ws-user") ?? "{}").id ?? "me"; } catch { return "me"; }
  }, []);

  const { isOnline } = usePresence();

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [convs, mems] = await Promise.all([
        apiGet<Conversation[]>("/communication/conversations"),
        apiGet<Member[]>("/workspaces/members").catch(() => [] as Member[]),
      ]);
      const rawConvs = extractItems<any>(convs);
      setConversations(rawConvs.map((c: any) => ({
        id: c.id,
        title: c.title ?? "Conversation",
        type: c.type === "GROUP" ? "GROUP" : "DIRECT",
        taskId: c.taskId,
        participants: (c.participants ?? []).map((p: any) => ({
          id: p.user?.id ?? p.userId ?? p.id,
          name: p.user?.name ?? p.name ?? "Unknown",
        })),
        lastMessage: c.messages?.[0]?.body ?? c.lastMessage,
        lastMessageAt: c.messages?.[0]?.createdAt ?? c.lastMessageAt,
        unread: c.unread ?? 0,
      })));
      setMembers(extractItems<any>(mems).map((m: any) => ({
        ...m,
        name: m.user?.name ?? m.name ?? m.email ?? "Unknown",
        email: m.user?.email ?? m.email ?? "",
        status: m.user?.status ?? m.status ?? "ACTIVE",
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Restore last-active conversation after conversations load
  useEffect(() => {
    if (conversations.length === 0 || activeId) return;
    const saved = sessionStorage.getItem("chat-active-conv");
    if (saved && conversations.find((c) => c.id === saved)) {
      setActiveId(saved);
    }
  }, [conversations, activeId]);

  // cleanup voice recording on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [audioPreviewUrl]);

  const active = conversations.find((c) => c.id === activeId);

  // load messages on conversation change
  useEffect(() => {
    if (!activeId) return;
    setMessagesLoading(true);
    setMessages([]);
    (async () => {
      try {
        const msgs = await apiGet<ChatMessage[]>(`/communication/conversations/${activeId}/messages`);
        setMessages(extractItems<any>(msgs).map((m: any) => ({
          ...m,
          senderName: m.sender?.name ?? m.senderName ?? m.senderId,
          type: m.type ?? "TEXT",
        })));
      } catch { setMessages([]); }
      finally { setMessagesLoading(false); }
    })();
  }, [activeId]);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // real-time
  useEffect(() => {
    const off = onRealtime((ev) => {
      if (ev.type === "conversation.message") {
        const { conversationId, messageId, body, senderName, senderId } = ev.payload;
        if (activeId === conversationId) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === messageId)) return prev;
            return [...prev, { id: messageId, conversationId, senderId, senderName, body, createdAt: new Date().toISOString(), type: "TEXT" } as any];
          });
        }
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, lastMessage: body, lastMessageAt: new Date().toISOString(), unread: activeId === conversationId ? 0 : (c.unread ?? 0) + 1 }
              : c,
          ),
        );
      }
    });
    return off;
  }, [activeId]);

  const filtered = useMemo(
    () => conversations.filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase())),
    [conversations, q],
  );
  const taskChats = filtered.filter((c) => !!c.taskId);
  const groupChats = filtered.filter((c) => !c.taskId && c.type === "GROUP");
  const directChats = filtered.filter((c) => !c.taskId && c.type !== "GROUP");

  const selectConversation = (id: string) => {
    setActiveId(id);
    setShowGroupInfo(false);
    sessionStorage.setItem("chat-active-conv", id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, unread: 0 } : c));
    setShowEmoji(false);
    cancelVoice();
  };

  // auto-resize textarea
  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // ── send text message ─────────────────────────────────────────────────────
  const send = async () => {
    if (!draft.trim() || !activeId) return;
    const body = draft.trim();
    setDraft("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    setSending(true);
    const tempMsg: any = {
      id: `msg-${Date.now()}`,
      conversationId: activeId,
      senderId: myId,
      senderName: "You",
      body,
      type: "TEXT",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setConversations((prev) => prev.map((c) => c.id === activeId ? { ...c, lastMessage: body, lastMessageAt: new Date().toISOString() } : c));
    try {
      await apiPost(`/communication/conversations/${activeId}/messages`, { body, type: "TEXT" });
    } catch { /* keep optimistic */ }
    finally { setSending(false); }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ── voice note ────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        setVoiceState("preview");
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      setRecSeconds(0);
      setVoiceState("recording");
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone permission denied or not available.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current?.stop();
  };

  const cancelVoice = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioBlob(null);
    setAudioPreviewUrl(null);
    setVoiceState("idle");
    setRecSeconds(0);
  };

  const sendVoiceNote = async () => {
    if (!audioBlob || !activeId) return;
    setVoiceUploading(true);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", audioBlob, "voice-note.webm");
      const res = await axios.post(`${API_URL}/media/upload?kind=AUDIO`, formData, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const uploadedUrl: string =
        res.data?.data?.url ?? res.data?.url ?? res.data?.data?.signedUrl ?? "";

      const tempMsg: any = {
        id: `msg-${Date.now()}`,
        conversationId: activeId,
        senderId: myId,
        senderName: "You",
        body: "🎤 Voice note",
        type: "VOICE_NOTE",
        attachmentUrl: uploadedUrl || audioPreviewUrl,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);
      setConversations((prev) => prev.map((c) => c.id === activeId ? { ...c, lastMessage: "🎤 Voice note", lastMessageAt: new Date().toISOString() } : c));

      await apiPost(`/communication/conversations/${activeId}/messages`, {
        type: "VOICE_NOTE",
        body: "Voice note",
        attachmentUrl: uploadedUrl || undefined,
      });
      cancelVoice();
    } catch {
      // fallback: send with local blob URL (preview only)
      const tempMsg: any = {
        id: `msg-${Date.now()}`,
        conversationId: activeId,
        senderId: myId,
        senderName: "You",
        body: "🎤 Voice note",
        type: "VOICE_NOTE",
        attachmentUrl: audioPreviewUrl,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);
      cancelVoice();
    } finally { setVoiceUploading(false); }
  };

  // ── send file attachment ──────────────────────────────────────────────────
  const sendFile = async (file: File) => {
    if (!activeId) return;
    setFileUploading(true);
    try {
      const token = getAuthToken();
      const isImage = file.type.startsWith("image/");
      const kind = isImage ? "IMAGE" : "FILE";
      const formData = new FormData();
      formData.append("file", file, file.name);
      const res = await axios.post(`${API_URL}/media/upload?kind=${kind}`, formData, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const uploadedUrl: string = res.data?.data?.url ?? res.data?.url ?? "";
      const localPreview = isImage ? URL.createObjectURL(file) : null;
      const tempMsg: any = {
        id: `msg-${Date.now()}`,
        conversationId: activeId,
        senderId: myId,
        senderName: "You",
        body: file.name,
        type: isImage ? "IMAGE" : "FILE",
        attachmentUrl: uploadedUrl || localPreview,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);
      setConversations((prev) => prev.map((c) => c.id === activeId
        ? { ...c, lastMessage: isImage ? "📷 Image" : `📎 ${file.name}`, lastMessageAt: new Date().toISOString() }
        : c,
      ));
      await apiPost(`/communication/conversations/${activeId}/messages`, {
        type: isImage ? "IMAGE" : "FILE",
        body: file.name,
        attachmentUrl: uploadedUrl || undefined,
      });
    } catch { /**/ }
    finally { setFileUploading(false); }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const ConvRow = ({ c }: { c: Conversation }) => {
    const isGroup = c.type === "GROUP";
    const isTask = !!c.taskId;
    // For DMs: the other person (not the current user)
    const dmPeer = !isGroup && !isTask
      ? c.participants.find((p) => p.id !== myId) ?? c.participants[0]
      : null;
    const dmOnline = dmPeer ? isOnline(dmPeer.id) : false;

    return (
      <button
        onClick={() => selectConversation(c.id)}
        className={clsx(
          "w-full border-b border-zinc-50 px-3 py-2.5 text-left transition hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/60",
          activeId === c.id && "bg-brand-50/60 dark:bg-brand-900/20",
        )}
      >
        <div className="flex items-center gap-2.5">
          {/* Icon / avatar */}
          {isGroup ? (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
          ) : isTask ? (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          ) : (
            /* DM avatar with online ring */
            <div className="relative flex-shrink-0">
              <Avatar name={c.title} />
              <span className={clsx(
                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900",
                dmOnline ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600",
              )} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{c.title}</p>
              <div className="flex flex-shrink-0 items-center gap-1">
                {(c.unread ?? 0) > 0 && (
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
                <span className="text-[10px] text-zinc-400">{fmtRelative(c.lastMessageAt)}</span>
              </div>
            </div>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-500">
              {c.lastMessage ?? (isGroup ? `${c.participants.length} members` : "No messages yet")}
            </p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col">
      <PageHeader title="Inbox" subtitle="All conversations across tasks and team members." />

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Conversations appear here when tasks have messages or when you start a direct chat."
          action={<Button size="sm" onClick={() => setNewModalMode("dm")}>New conversation</Button>}
        />
      ) : (
        <div className="grid h-[calc(100vh-220px)] grid-cols-1 gap-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 md:grid-cols-[300px_1fr]">

          {/* ── Left: conversation list ── */}
          <div className="flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            {/* Search + action buttons */}
            <div className="space-y-2 border-b border-zinc-100 p-3 dark:border-zinc-800">
              <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewModalMode("dm")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  New message
                </button>
                <button
                  onClick={() => setNewModalMode("group")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-purple-200 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:border-purple-800/60 dark:text-purple-400 dark:hover:bg-purple-900/20"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                  New group
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {groupChats.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Group chats</p>
                  </div>
                  {groupChats.map((c) => <ConvRow key={c.id} c={c} />)}
                </>
              )}
              {directChats.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Direct messages</p>
                  </div>
                  {directChats.map((c) => <ConvRow key={c.id} c={c} />)}
                </>
              )}
              {taskChats.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Task chats</p>
                  {taskChats.map((c) => <ConvRow key={c.id} c={c} />)}
                </>
              )}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <svg className="h-8 w-8 text-zinc-300 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-xs text-zinc-400">No conversations yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: message thread + optional group info panel ── */}
          <div className="flex overflow-hidden bg-zinc-50 dark:bg-zinc-950">
            {/* message column */}
            <div className="flex flex-1 flex-col overflow-hidden">
            {active ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    {active.type === "GROUP" ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      </div>
                    ) : (
                      <Avatar name={active.title} size="md" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{active.title}</p>
                      {active.type === "GROUP" ? (
                        <p className="text-[10px] text-zinc-400">
                          {active.participants.length} member{active.participants.length !== 1 ? "s" : ""} · {active.participants.slice(0, 3).map((p) => p.name).join(", ")}{active.participants.length > 3 ? ` +${active.participants.length - 3}` : ""}
                        </p>
                      ) : (() => {
                        const peer = active.participants.find((p) => p.id !== myId) ?? active.participants[0];
                        const online = peer ? isOnline(peer.id) : false;
                        return (
                          <p className="flex items-center gap-1 text-[10px] text-zinc-400">
                            <span className={clsx("h-1.5 w-1.5 rounded-full", online ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600")} />
                            {online ? "Online" : "Offline"}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {active.taskId && <Badge tone="info">Task chat</Badge>}
                    {active.type === "GROUP" && (
                      <button
                        onClick={() => setShowGroupInfo((v) => !v)}
                        title="Group info"
                        className={clsx(
                          "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                          showGroupInfo
                            ? "border-purple-300 bg-purple-100 text-purple-600 dark:border-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                            : "border-zinc-200 text-zinc-500 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 dark:border-zinc-700 dark:hover:border-purple-700 dark:hover:text-purple-400",
                        )}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {messagesLoading && <LoadingState label="Loading messages..." />}
                  {!messagesLoading && messages.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-zinc-400">No messages yet. Say hello 👋</p>
                    </div>
                  )}
                  {messages.map((m) => {
                    const isMe = m.senderId === myId || m.senderId === "me";
                    const msgType = (m as any).type ?? "TEXT";
                    const attachUrl = (m as any).attachmentUrl ?? null;
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`flex max-w-[72%] flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <p className="mb-1 text-[10px] text-zinc-400">
                            {!isMe && <span className="mr-1 font-medium text-zinc-500">{m.senderName}</span>}
                            {fmtRelative(m.createdAt)}
                          </p>
                          {msgType === "VOICE_NOTE" && attachUrl ? (
                            <VoicePlayer url={attachUrl} />
                          ) : msgType === "IMAGE" && attachUrl ? (
                            <img
                              src={attachUrl}
                              alt={m.body ?? "image"}
                              className="max-w-[260px] rounded-2xl object-cover shadow-sm"
                              style={{ maxHeight: 200 }}
                            />
                          ) : msgType === "FILE" && attachUrl ? (
                            <a
                              href={attachUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={clsx(
                                "flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm",
                                isMe ? "bg-brand-600 text-white" : "bg-white text-zinc-800 shadow-sm dark:bg-zinc-800 dark:text-zinc-200",
                              )}
                            >
                              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              {m.body ?? "File"}
                            </a>
                          ) : (
                            <div className={clsx(
                              "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                              isMe
                                ? "rounded-br-sm bg-brand-600 text-white"
                                : "rounded-bl-sm bg-white text-zinc-800 shadow-sm dark:bg-zinc-800 dark:text-zinc-200",
                            )}>
                              <MessageBody text={m.body ?? ""} isMe={isMe} />
                            </div>
                          )}
                          {isMe && (
                            <span className="mt-0.5 text-[9px] text-zinc-300 dark:text-zinc-600">✓✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* ── Input area ── */}
                <div className="relative border-t border-zinc-200 bg-white px-3 pb-3 pt-2 dark:border-zinc-800 dark:bg-zinc-900">
                  {/* emoji picker */}
                  {showEmoji && (
                    <EmojiPicker
                      onSelect={(emoji) => {
                        setDraft((prev) => prev + emoji);
                        textareaRef.current?.focus();
                      }}
                      onClose={() => setShowEmoji(false)}
                    />
                  )}

                  {/* hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xlsx,.csv,.zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) sendFile(file);
                      e.target.value = "";
                    }}
                  />

                  {voiceState === "idle" && (
                    <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-2 py-1.5 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-brand-500 dark:focus-within:ring-brand-900">
                      {/* attach button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={fileUploading}
                        title="Attach file"
                        className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-white hover:text-zinc-600 disabled:opacity-40 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      >
                        {fileUploading ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-brand-500" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        )}
                      </button>

                      {/* mic button */}
                      <button
                        type="button"
                        onClick={startRecording}
                        title="Voice note"
                        className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-white hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>

                      {/* textarea */}
                      <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={(e) => { setDraft(e.target.value); resizeTextarea(); }}
                        onKeyDown={onKeyDown}
                        placeholder="Message..."
                        rows={1}
                        className="max-h-[120px] flex-1 resize-none bg-transparent py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
                        style={{ overflowY: "auto" }}
                      />

                      {/* emoji + send */}
                      <div className="mb-0.5 flex flex-shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowEmoji((v) => !v)}
                          title="Emoji"
                          className={clsx(
                            "flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-white hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300",
                            showEmoji && "bg-white text-brand-600 dark:bg-zinc-700",
                          )}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={send}
                          disabled={!draft.trim() || sending}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-30"
                          title="Send (Enter)"
                        >
                          {sending ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <svg className="h-4 w-4 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="mt-1.5 text-center text-[10px] text-zinc-400 dark:text-zinc-600">
                    Enter to send · Shift+Enter for new line
                  </p>

                  {voiceState === "recording" && (
                    <div className="flex items-center gap-3 p-3">
                      <button onClick={cancelVoice} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-red-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="flex flex-1 items-center gap-2">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                        <span className="text-sm font-medium text-red-500">Recording {fmtTimer(recSeconds)}</span>
                        <div className="flex flex-1 items-center gap-0.5">
                          {Array.from({ length: 20 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-1 rounded-full bg-brand-400 opacity-60"
                              style={{ height: `${8 + Math.sin(Date.now() / 200 + i) * 6}px`, transition: "height 0.1s" }}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={stopRecording}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {voiceState === "preview" && audioPreviewUrl && (
                    <div className="flex items-center gap-3 p-3">
                      <button onClick={cancelVoice} className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-red-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <div className="flex-1">
                        <VoicePlayer url={audioPreviewUrl} />
                      </div>
                      <button
                        onClick={sendVoiceNote}
                        disabled={voiceUploading}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {voiceUploading ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm text-zinc-400">Select a conversation to start messaging</p>
                <Button size="sm" variant="outline" onClick={() => setNewModalMode("dm")}>New conversation</Button>
              </div>
            )}
            </div>{/* end message column */}

            {/* ── Group info panel ── */}
            {showGroupInfo && active?.type === "GROUP" && (
              <div className="flex w-64 flex-shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {/* Panel header */}
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Group info</span>
                  <button
                    onClick={() => setShowGroupInfo(false)}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Group identity */}
                <div className="flex flex-col items-center gap-2 border-b border-zinc-100 px-4 py-5 dark:border-zinc-800">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                  <p className="text-center text-sm font-semibold text-zinc-900 dark:text-zinc-50">{active.title}</p>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
                    {active.participants.length} member{active.participants.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Members list */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Members</p>
                  <div className="space-y-1">
                    {active.participants.map((p) => {
                      const online = isOnline(p.id);
                      const isCurrentUser = p.id === myId;
                      return (
                        <div key={p.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                          <div className="relative flex-shrink-0">
                            <Avatar name={p.name} size="sm" />
                            <span className={clsx(
                              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900",
                              online ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600",
                            )} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                              {p.name}{isCurrentUser && <span className="ml-1 text-[10px] text-zinc-400">(you)</span>}
                            </p>
                            <p className="text-[10px] text-zinc-400">{online ? "Online" : "Offline"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>{/* end right flex row */}
        </div>
      )}

      {newModalMode && (
        <NewConversationModal
          members={members}
          defaultMode={newModalMode}
          onClose={() => setNewModalMode(null)}
          onCreate={(conv) => {
            setConversations((prev) => [conv, ...prev]);
            setActiveId(conv.id);
            sessionStorage.setItem("chat-active-conv", conv.id);
          }}
        />
      )}
    </div>
  );
}
