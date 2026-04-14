"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import type { ChatMessage, Conversation, Member } from "@/lib/types";
import { fmtRelative } from "@/lib/format";
import { onRealtime } from "@/lib/socket";
import clsx from "clsx";

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const letters = name.trim().split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div className={`inline-flex flex-shrink-0 items-center justify-center rounded-full bg-brand-600 font-medium text-white ${sz}`}>
      {letters || "?"}
    </div>
  );
}

function NewConversationModal({ members, onClose, onCreate }: {
  members: Member[];
  onClose: () => void;
  onCreate: (conv: Conversation) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member[]>([]);
  const [creating, setCreating] = useState(false);

  const filtered = members.filter((m) =>
    !selected.find((s) => s.id === m.id) &&
    (m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())),
  );

  const create = async () => {
    if (!selected.length) return;
    setCreating(true);
    try {
      const conv = await apiPost<Conversation>("/communication/conversations", {
        participantIds: selected.map((m) => m.userId),
        title: selected.map((m) => m.name).join(", "),
      });
      onCreate(conv);
      onClose();
    } catch {
      // Best effort
      const mock: Conversation = {
        id: `conv-${Date.now()}`,
        title: selected.map((m) => m.name).join(", "),
        participants: selected.map((m) => ({ id: m.userId, name: m.name })),
        unread: 0,
      };
      onCreate(mock);
      onClose();
    } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">New conversation</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">✕</button>
        </div>
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
        {selected.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {selected.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {m.name}
                <button onClick={() => setSelected((prev) => prev.filter((s) => s.id !== m.id))} className="hover:text-red-500">✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-100 dark:border-zinc-800">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-400">{search ? "No users found." : "No team members available."}</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected((prev) => [...prev, m])}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Avatar name={m.name} />
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{m.name}</p>
                  <p className="text-[10px] text-zinc-400">{m.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={create} disabled={!selected.length || creating}>
            {creating ? "Creating..." : "Start conversation"}
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  const [showNewModal, setShowNewModal] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load current user id from localStorage
  const myId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("ws-user") ?? "{}").id ?? "me"; } catch { return "me"; }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [convs, mems] = await Promise.all([
        apiGet<Conversation[]>("/communication/conversations"),
        apiGet<Member[]>("/workspaces/members").catch(() => [] as Member[]),
      ]);
      setConversations(Array.isArray(convs) ? convs : []);
      setMembers(Array.isArray(mems) ? mems : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = conversations.find((c) => c.id === activeId);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeId) return;
    setMessagesLoading(true);
    (async () => {
      try {
        const msgs = await apiGet<ChatMessage[]>(`/communication/conversations/${activeId}/messages`);
        setMessages(Array.isArray(msgs) ? msgs : []);
      } catch { setMessages([]); }
      finally { setMessagesLoading(false); }
    })();
  }, [activeId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Real-time
  useEffect(() => {
    const off = onRealtime((ev) => {
      if (ev.type === "task.message") {
        if (active?.taskId === ev.payload.taskId) {
          setMessages((prev) => [...prev, {
            id: ev.payload.messageId,
            taskId: ev.payload.taskId,
            senderId: "rt",
            senderName: ev.payload.senderName ?? "Agent",
            body: ev.payload.body ?? "...",
            createdAt: new Date().toISOString(),
          }]);
        }
        setConversations((prev) =>
          prev.map((c) =>
            c.taskId === ev.payload.taskId
              ? { ...c, unread: (c.unread ?? 0) + 1, lastMessage: ev.payload.body ?? "...", lastMessageAt: new Date().toISOString() }
              : c,
          ),
        );
      }
    });
    return off;
  }, [active]);

  const filtered = useMemo(
    () => conversations.filter((c) => !q || c.title.toLowerCase().includes(q.toLowerCase())),
    [conversations, q],
  );

  // Group conversations
  const taskChats = filtered.filter((c) => !!c.taskId);
  const directChats = filtered.filter((c) => !c.taskId);

  const selectConversation = (id: string) => {
    setActiveId(id);
    setConversations((prev) => prev.map((c) => c.id === id ? { ...c, unread: 0 } : c));
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    const body = draft.trim();
    setDraft("");
    setSending(true);
    const tempMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: activeId,
      senderId: myId,
      senderName: "You",
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setConversations((prev) =>
      prev.map((c) => c.id === activeId ? { ...c, lastMessage: body, lastMessageAt: new Date().toISOString() } : c),
    );
    try {
      await apiPost(`/communication/conversations/${activeId}/messages`, { body });
    } catch { /* keep optimistic update */ }
    finally { setSending(false); }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const ConvRow = ({ c }: { c: Conversation }) => (
    <button
      key={c.id}
      onClick={() => selectConversation(c.id)}
      className={clsx(
        "w-full border-b border-zinc-50 px-3 py-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60",
        activeId === c.id && "bg-brand-50/40 dark:bg-brand-900/10",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={c.title} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{c.title}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {(c.unread ?? 0) > 0 && <Badge tone="danger">{c.unread}</Badge>}
              <span className="text-[10px] text-zinc-400">{fmtRelative(c.lastMessageAt)}</span>
            </div>
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{c.lastMessage ?? "No messages yet"}</p>
        </div>
      </div>
    </button>
  );

  return (
    <div className="flex flex-col">
      <PageHeader title="Inbox" subtitle="All conversations across tasks and team members." />

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Conversations appear here when tasks have messages or when you start a direct chat."
          action={<Button size="sm" onClick={() => setShowNewModal(true)}>New conversation</Button>}
        />
      ) : (
        <div className="grid h-[calc(100vh-220px)] grid-cols-1 gap-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 md:grid-cols-[300px_1fr]">
          {/* Left: conversation list */}
          <div className="flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-100 p-3 dark:border-zinc-800">
              <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
              <button
                onClick={() => setShowNewModal(true)}
                title="New conversation"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-brand-400 hover:text-brand-600 dark:border-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {taskChats.length > 0 && (
                <>
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Task chats</p>
                  {taskChats.map((c) => <ConvRow key={c.id} c={c} />)}
                </>
              )}
              {directChats.length > 0 && (
                <>
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Direct messages</p>
                  {directChats.map((c) => <ConvRow key={c.id} c={c} />)}
                </>
              )}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-xs text-zinc-400">No conversations match your search.</p>
              )}
            </div>
          </div>

          {/* Right: message thread */}
          <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950">
            {active ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={active.title} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{active.title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-zinc-400">
                          {active.participants.slice(0, 3).map((p) => p.name).join(", ")}
                          {active.participants.length > 3 ? ` +${active.participants.length - 3}` : ""}
                        </p>
                        {active.taskId && (
                          <Badge tone="info">Task chat</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {messagesLoading && <LoadingState label="Loading messages..." />}
                  {!messagesLoading && messages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-zinc-400">No messages yet. Start the conversation below.</p>
                    </div>
                  )}
                  {messages.map((m) => {
                    const isMe = m.senderId === myId || m.senderId === "me";
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`flex max-w-[70%] flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <p className="mb-1 text-[10px] text-zinc-400">
                            {!isMe && <span className="mr-1 font-medium text-zinc-500">{m.senderName}</span>}
                            {fmtRelative(m.createdAt)}
                          </p>
                          <div className={`rounded-2xl px-3.5 py-2 text-sm ${isMe ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-white text-zinc-800 shadow-sm dark:bg-zinc-800 dark:text-zinc-200"}`}>
                            {m.body}
                          </div>
                          {isMe && (
                            <span className="mt-0.5 text-[9px] text-zinc-300 dark:text-zinc-600">✓✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={send} className="flex items-center gap-2 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <button type="button" disabled title="Attach file (coming soon)"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 disabled:opacity-40">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                  <Input
                    placeholder="Write a message..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="flex-1"
                    autoComplete="off"
                  />
                  <button type="button" disabled title="Emoji (coming soon)"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 disabled:opacity-40">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  <Button type="submit" size="sm" disabled={!draft.trim() || sending}>
                    {sending ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <svg className="h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm text-zinc-400">Select a conversation to start messaging</p>
                <Button size="sm" variant="outline" onClick={() => setShowNewModal(true)}>New conversation</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {showNewModal && (
        <NewConversationModal
          members={members}
          onClose={() => setShowNewModal(false)}
          onCreate={(conv) => {
            setConversations((prev) => [conv, ...prev]);
            setActiveId(conv.id);
          }}
        />
      )}
    </div>
  );
}
