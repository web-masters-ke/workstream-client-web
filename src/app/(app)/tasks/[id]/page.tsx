"use client";

import { useEffect, useState, FormEvent, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, Textarea } from "@/components/ui";
import { apiGet, apiPost, apiPatch, extractItems } from "@/lib/api";
import type { ActivityEvent, ChatMessage, Task, TaskStatus, QaReview, TaskSubmission, SubmissionRound, SubmissionType } from "@/lib/types";
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
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [forceFail, setForceFail] = useState(false);
  const [failReason, setFailReason] = useState("");

  // Submission form
  const [showSubmit, setShowSubmit] = useState(false);
  const [subRound, setSubRound] = useState<SubmissionRound>("FIRST_DRAFT");
  const [subType, setSubType] = useState<SubmissionType>("LINK");
  const [subContent, setSubContent] = useState("");
  const [subNotes, setSubNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const t = await apiGet<Task>(`/tasks/${id}`);
        setTask(t);
        const [e, m, q, subs] = await Promise.all([
          apiGet<ActivityEvent[]>(`/tasks/${id}/activity`).catch(() => [] as ActivityEvent[]),
          apiGet<ChatMessage[]>(`/tasks/${id}/messages`).catch(() => [] as ChatMessage[]),
          apiGet<QaReview[]>(`/qa/reviews?taskId=${id}`).catch(() => [] as QaReview[]),
          apiGet<TaskSubmission[]>(`/tasks/${id}/submissions`).catch(() => [] as TaskSubmission[]),
        ]);
        setEvents(extractItems<ActivityEvent>(e));
        setMessages(extractItems<ChatMessage>(m));
        setQaReviews(extractItems<QaReview>(q));
        setSubmissions(extractItems<TaskSubmission>(subs));
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

  const submitWork = async () => {
    if (!id || !subContent.trim()) { setSubmitError("Please add a link, file URL, or text content."); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const s = await apiPost<TaskSubmission>(`/tasks/${id}/submissions`, {
        round: subRound,
        type: subType,
        content: subContent.trim(),
        notes: subNotes.trim() || undefined,
      });
      setSubmissions((prev) => [s, ...prev]);
      setTask((prev) => prev ? { ...prev, status: "UNDER_REVIEW" as TaskStatus } : prev);
      setShowSubmit(false);
      setSubContent("");
      setSubNotes("");
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const reviewSubmission = async (subId: string, status: "APPROVED" | "REVISION_REQUESTED" | "REJECTED", reviewNote?: string) => {
    if (!id) return;
    try {
      const updated = await apiPatch<TaskSubmission>(`/tasks/${id}/submissions/${subId}`, { status, reviewNote });
      setSubmissions((prev) => prev.map((s) => s.id === subId ? updated : s));
      if (status === "APPROVED") setTask((prev) => prev ? { ...prev, status: "COMPLETED" as TaskStatus } : prev);
      if (status === "REVISION_REQUESTED") setTask((prev) => prev ? { ...prev, status: "IN_PROGRESS" as TaskStatus } : prev);
    } catch { /* keep existing state */ }
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
              <Info label="Job" value={task.jobTitle || task.jobId || "—"} />
              <Info label="QA score" value={task.qaScore != null ? `${task.qaScore}%` : "—"} />
              <Info label="Due" value={fmtDate(task.dueAt)} />
            </dl>
          </Card>

          {/* Submissions */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Work submissions
                {submissions.length > 0 && <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{submissions.length}</span>}
              </h2>
              {(task.status === "IN_PROGRESS" || task.status === "ASSIGNED") && (
                <Button size="sm" onClick={() => setShowSubmit((v) => !v)}>
                  {showSubmit ? "Cancel" : "+ Submit work"}
                </Button>
              )}
            </div>

            {showSubmit && (
              <div className="mb-4 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">New submission</h3>
                {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Round</label>
                    <Select value={subRound} onChange={(e) => setSubRound(e.target.value as SubmissionRound)}>
                      <option value="FIRST_DRAFT">First draft</option>
                      <option value="SECOND_DRAFT">Second draft</option>
                      <option value="FINAL">Final delivery</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Type</label>
                    <Select value={subType} onChange={(e) => setSubType(e.target.value as SubmissionType)}>
                      <option value="LINK">Link / URL</option>
                      <option value="FILE">File URL</option>
                      <option value="TEXT">Text / notes</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">
                    {subType === "TEXT" ? "Content *" : "URL / link *"}
                  </label>
                  <Textarea
                    value={subContent}
                    onChange={(e) => setSubContent(e.target.value)}
                    placeholder={subType === "TEXT" ? "Paste your work here…" : "https://…"}
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-wider text-zinc-500">Notes to reviewer</label>
                  <Textarea
                    value={subNotes}
                    onChange={(e) => setSubNotes(e.target.value)}
                    placeholder="Any context, changes made, questions…"
                    className="min-h-[60px]"
                  />
                </div>
                <Button onClick={submitWork} disabled={submitting || !subContent.trim()}>
                  {submitting ? "Submitting…" : "Submit"}
                </Button>
              </div>
            )}

            {submissions.length === 0 && !showSubmit && (
              <p className="text-sm text-zinc-400">No submissions yet.</p>
            )}

            <div className="space-y-3">
              {submissions.map((s) => (
                <SubmissionCard key={s.id} submission={s} onReview={reviewSubmission} />
              ))}
            </div>
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

const ROUND_LABEL: Record<string, string> = {
  FIRST_DRAFT: "First draft",
  SECOND_DRAFT: "Second draft",
  FINAL: "Final delivery",
};

const STATUS_TONE: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REVISION_REQUESTED: "warning",
  REJECTED: "danger",
};

function SubmissionCard({
  submission,
  onReview,
}: {
  submission: TaskSubmission;
  onReview: (id: string, status: "APPROVED" | "REVISION_REQUESTED" | "REJECTED", note?: string) => void;
}) {
  const [reviewNote, setReviewNote] = useState("");
  const [showReview, setShowReview] = useState(false);

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[submission.status] ?? "default"}>{submission.status.replace("_", " ")}</Badge>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{ROUND_LABEL[submission.round] ?? submission.round}</span>
            {submission.agentName && <span className="text-xs text-zinc-400">by {submission.agentName}</span>}
            <span className="text-xs text-zinc-400">{fmtRelative(submission.submittedAt)}</span>
          </div>
          {submission.content && (
            submission.type === "LINK" || submission.type === "FILE" ? (
              <a href={submission.content} target="_blank" rel="noopener noreferrer" className="mt-1.5 block truncate text-sm text-brand-600 underline dark:text-brand-400">
                {submission.content}
              </a>
            ) : (
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{submission.content}</p>
            )
          )}
          {submission.notes && <p className="mt-1 text-xs italic text-zinc-500">"{submission.notes}"</p>}
          {submission.reviewNote && (
            <div className="mt-2 rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Feedback: {submission.reviewNote}
            </div>
          )}
        </div>
        {submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW" ? (
          <Button size="sm" variant="outline" onClick={() => setShowReview((v) => !v)}>
            Review
          </Button>
        ) : null}
      </div>

      {showReview && (
        <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-700">
          <Textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Feedback note (optional for approval, required for revision/rejection)…"
            className="min-h-[60px] text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onReview(submission.id, "APPROVED", reviewNote || undefined); setShowReview(false); }}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => { onReview(submission.id, "REVISION_REQUESTED", reviewNote || undefined); setShowReview(false); }}>
              Request revision
            </Button>
            <Button size="sm" variant="danger" onClick={() => { onReview(submission.id, "REJECTED", reviewNote || undefined); setShowReview(false); }}>
              Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
