"use client";

import { useEffect, useState, FormEvent, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, Textarea } from "@/components/ui";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import type { ActivityEvent, ChatMessage, Task, TaskStatus, QaReview } from "@/lib/types";
import { fmtDate, fmtRelative } from "@/lib/format";
import { onRealtime } from "@/lib/socket";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [task, setTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [qaReviews, setQaReviews] = useState<QaReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [forceFail, setForceFail] = useState(false);
  const [failReason, setFailReason] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const t = await apiGet<Task>(`/tasks/${id}`);
        setTask(t);
        const [e, m, q] = await Promise.all([
          apiGet<ActivityEvent[]>(`/tasks/${id}/activity`).catch(() => [] as ActivityEvent[]),
          apiGet<ChatMessage[]>(`/tasks/${id}/messages`).catch(() => [] as ChatMessage[]),
          apiGet<QaReview[]>(`/qa/reviews?taskId=${id}`).catch(() => [] as QaReview[]),
        ]);
        setEvents(Array.isArray(e) ? e : []);
        setMessages(Array.isArray(m) ? m : []);
        setQaReviews(Array.isArray(q) ? q : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load task");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  // Real-time messages
  useEffect(() => {
    const off = onRealtime((ev) => {
      if (ev.type === "task.message" && ev.payload.taskId === id) {
        setMessages((prev) => [
          ...prev,
          {
            id: ev.payload.messageId,
            taskId: ev.payload.taskId,
            senderId: "unknown",
            senderName: ev.payload.senderName ?? "Agent",
            body: ev.payload.body ?? "...",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      if (ev.type === "task.status_changed" && ev.payload.taskId === id) {
        setTask((prev) => (prev ? { ...prev, status: ev.payload.status as TaskStatus } : prev));
      }
    });
    return off;
  }, [id]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !id) return;
    const temp: ChatMessage = {
      id: `tmp-${Date.now()}`,
      taskId: id,
      senderId: "me",
      senderName: "You",
      body: draft,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temp]);
    setDraft("");
    try {
      await apiPost(`/tasks/${id}/messages`, { body: temp.body });
    } catch { /* keep optimistic message */ }
  }

  const doForceFail = async () => {
    if (!id || !failReason.trim()) return;
    try { await apiPatch(`/tasks/${id}`, { status: "FAILED", failedReason: failReason }); } catch { /* fallback */ }
    setTask((prev) => (prev ? { ...prev, status: "FAILED", failedReason: failReason } : prev));
    setForceFail(false);
    setFailReason("");
  };

  const cloneTask = () => {
    router.push("/tasks");
  };

  const callStub = () => {
    window.alert("Call feature coming soon. This will initiate a VoIP call with the assigned agent.");
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!task) return <EmptyState title="Task not found" message="This task does not exist or was deleted." />;

  const statusToneMap: Record<TaskStatus, "default" | "info" | "warning" | "success" | "danger"> = {
    PENDING: "default", ASSIGNED: "info", IN_PROGRESS: "warning", COMPLETED: "success", FAILED: "danger", CANCELLED: "default",
  };

  return (
    <div>
      <PageHeader
        title={task.title}
        subtitle={`Task ${task.id} · Created ${fmtDate(task.createdAt)}`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={callStub}>Call</Button>
            <Button size="sm" variant="outline" onClick={cloneTask}>Clone</Button>
            <Button size="sm" variant="danger" onClick={() => setForceFail(true)}>Force fail</Button>
            <Badge tone={statusToneMap[task.status]}>{task.status.replace("_", " ")}</Badge>
          </div>
        }
      />

      {forceFail && (
        <Card className="mb-4 border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/30">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">Force fail this task</h3>
          <Textarea placeholder="Reason for failure (required)" value={failReason} onChange={(e) => setFailReason(e.target.value)} className="mt-2" />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="danger" onClick={doForceFail} disabled={!failReason.trim()}>Confirm fail</Button>
            <Button size="sm" variant="ghost" onClick={() => setForceFail(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Live status indicator */}
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className={`h-2 w-2 rounded-full ${task.status === "IN_PROGRESS" ? "animate-pulse bg-amber-500" : task.status === "COMPLETED" ? "bg-emerald-500" : task.status === "FAILED" ? "bg-red-500" : "bg-zinc-400"}`} />
        <span className="text-zinc-600 dark:text-zinc-300">{task.status === "IN_PROGRESS" ? "Live — agent working" : task.status}</span>
        {task.failedReason && <span className="text-red-600">— {task.failedReason}</span>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Details</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <Info label="Priority" value={task.priority} />
              <Info label="SLA" value={`${task.slaMinutes} min`} />
              <Info label="Agent" value={task.assignedAgentName ?? "Unassigned"} />
              <Info label="Skill" value={task.skill ?? "—"} />
              <Info label="Started" value={fmtDate(task.startedAt)} />
              <Info label="Completed" value={fmtDate(task.completedAt)} />
              <Info label="Job" value={task.jobTitle || task.jobId} />
              <Info label="QA score" value={task.qaScore != null ? `${task.qaScore}%` : "—"} />
              <Info label="Due" value={fmtDate(task.dueAt)} />
            </dl>
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Activity timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-zinc-400">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-brand-500" />
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">
                      <span className="font-medium">{e.actorName}</span> {e.message}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{fmtRelative(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {qaReviews.length > 0 && (
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">QA reviews</h2>
              <ul className="space-y-3">
                {qaReviews.map((r) => (
                  <li key={r.id} className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Reviewed by {r.reviewerName}</span>
                      <Badge tone={r.score >= 80 ? "success" : r.score >= 50 ? "warning" : "danger"}>{r.score}%</Badge>
                    </div>
                    {r.feedback && <p className="mt-1 text-xs text-zinc-500">{r.feedback}</p>}
                    <p className="mt-1 text-[10px] text-zinc-400">{fmtRelative(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card className="flex h-[680px] flex-col p-0">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="text-sm font-semibold dark:text-zinc-50">Chat</span>
            <span className="text-[10px] text-zinc-400">{messages.length} messages</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-xs text-zinc-400">No messages yet. Start the conversation below.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`text-sm ${m.senderId === "me" ? "ml-auto max-w-[80%] text-right" : ""}`}>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {m.senderName} · {fmtRelative(m.createdAt)}
                </p>
                <p className={`mt-0.5 inline-block rounded-lg px-3 py-1.5 text-sm ${m.senderId === "me" ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"}`}>
                  {m.body}
                </p>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <Input placeholder="Write a message" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" size="sm">Send</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
