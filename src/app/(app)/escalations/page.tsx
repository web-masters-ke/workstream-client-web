"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { apiGet, apiPatch, apiPost, extractItems } from "@/lib/api";
import type { Task } from "@/lib/types";
import { fmtRelative, fmtDate } from "@/lib/format";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type EscStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";

interface Esc {
  id: string;
  taskId: string;
  taskTitle: string;
  subject: string;
  reason: string;
  category: string;
  priority: Priority;
  status: EscStatus;
  raisedBy: string;
  assignedTo?: string;
  expectedResolutionHours: number;
  evidence?: string;
  createdAt: string;
}

const CATEGORIES = [
  "SLA Breach",
  "Agent Conduct",
  "Task Quality",
  "Payment Dispute",
  "Client Complaint",
  "System / Technical Issue",
  "Policy Violation",
  "Other",
];

function priorityTone(p: Priority) {
  return p === "URGENT" ? "danger" : p === "HIGH" ? "warning" : p === "MEDIUM" ? "info" : "default";
}
function statusTone(s: EscStatus) {
  return s === "RESOLVED" ? "success" : s === "IN_REVIEW" ? "warning" : s === "DISMISSED" ? "default" : "danger";
}

// Map a task that has been escalated (ON_HOLD) into our Esc shape
function taskToEsc(t: any): Esc {
  return {
    id: t.id,
    taskId: t.id,
    taskTitle: t.title,
    subject: t.title,
    reason: t.metadata?.escalationReason ?? t.description ?? "No reason provided",
    category: t.metadata?.escalationCategory ?? "Other",
    priority: (t.priority as Priority) ?? "MEDIUM",
    status: t.metadata?.escalationStatus ?? "OPEN",
    raisedBy: t.metadata?.escalationRaisedBy ?? "Unknown",
    assignedTo: t.metadata?.escalationAssignedTo,
    expectedResolutionHours: t.metadata?.escalationExpectedHours ?? 24,
    evidence: t.metadata?.escalationEvidence,
    createdAt: t.updatedAt ?? t.createdAt,
  };
}

export default function EscalationsPage() {
  const [escs, setEscs] = useState<Esc[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | EscStatus>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | Priority>("");
  const [drawer, setDrawer] = useState<Esc | null>(null);
  const [actioning, setActioning] = useState(false);

  // ── New escalation modal state ──
  const [showNew, setShowNew] = useState(false);
  const [newTaskId, setNewTaskId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newPriority, setNewPriority] = useState<Priority>("HIGH");
  const [newReason, setNewReason] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newExpectedHours, setNewExpectedHours] = useState(24);
  const [newEvidence, setNewEvidence] = useState("");
  const [newImpact, setNewImpact] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [tasks, activeTasks] = await Promise.all([
        apiGet<any>("/tasks?status=ON_HOLD").catch(() => ({ items: [] })),
        apiGet<any>("/tasks").catch(() => ({ items: [] })),
      ]);
      const taskArr = extractItems<Task>(tasks);
      const allArr = extractItems<Task>(activeTasks);
      setEscs(taskArr.map(taskToEsc));
      setAllTasks(allArr);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load escalations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => escs.filter((e) => {
    if (statusFilter && e.status !== statusFilter) return false;
    if (priorityFilter && e.priority !== priorityFilter) return false;
    return true;
  }), [escs, statusFilter, priorityFilter]);

  const open = escs.filter((e) => e.status === "OPEN");
  const resolved = escs.filter((e) => e.status === "RESOLVED");
  const overdue = escs.filter((e) => e.status === "OPEN" && (Date.now() - new Date(e.createdAt).getTime()) > e.expectedResolutionHours * 3600000);

  const openNew = () => {
    setNewTaskId(""); setNewSubject(""); setNewCategory(CATEGORIES[0]);
    setNewPriority("HIGH"); setNewReason(""); setNewAssignedTo("");
    setNewExpectedHours(24); setNewEvidence(""); setNewImpact(""); setCreateErr(null);
    setShowNew(true);
  };

  const handleCreate = async () => {
    if (!newTaskId) { setCreateErr("Please select a task to escalate."); return; }
    if (!newSubject.trim()) { setCreateErr("Subject is required."); return; }
    if (!newReason.trim()) { setCreateErr("Detailed reason is required."); return; }
    setCreating(true); setCreateErr(null);
    try {
      const fullReason = `[${newCategory}] ${newReason}${newImpact ? `\n\nBusiness impact: ${newImpact}` : ""}${newEvidence ? `\n\nEvidence / context: ${newEvidence}` : ""}`;
      await apiPost(`/tasks/${newTaskId}/escalate`, { reason: fullReason });
      // Patch local task metadata for display
      const srcTask = allTasks.find((t) => t.id === newTaskId);
      const newEsc: Esc = {
        id: newTaskId,
        taskId: newTaskId,
        taskTitle: srcTask?.title ?? "Unknown task",
        subject: newSubject.trim(),
        reason: fullReason,
        category: newCategory,
        priority: newPriority,
        status: "OPEN",
        raisedBy: "You",
        assignedTo: newAssignedTo || undefined,
        expectedResolutionHours: newExpectedHours,
        evidence: newEvidence || undefined,
        createdAt: new Date().toISOString(),
      };
      setEscs((prev) => [newEsc, ...prev]);
      setAllTasks((prev) => prev.filter((t) => t.id !== newTaskId));
      setShowNew(false);
    } catch (e: unknown) {
      setCreateErr(e instanceof Error ? e.message : "Failed to raise escalation.");
    } finally {
      setCreating(false);
    }
  };

  const patchEsc = async (id: string, patch: Partial<Esc>) => {
    setEscs((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    try { await apiPatch(`/tasks/${id}/transition`, { status: patch.status === "RESOLVED" ? "COMPLETED" : "IN_PROGRESS" }); } catch { /* stub */ }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      {/* ── Raise escalation modal ── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-zinc-900" style={{ maxHeight: "90vh" }}>
            <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Raise escalation</h2>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Flag a task for immediate supervisor attention.</p>
            </div>

            <div className="space-y-4 px-6 py-5">
              {/* Task selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Task to escalate <span className="text-red-500">*</span>
                </label>
                <select
                  value={newTaskId}
                  onChange={(e) => {
                    setNewTaskId(e.target.value);
                    const t = allTasks.find((t) => t.id === e.target.value);
                    if (t && !newSubject) setNewSubject(t.title);
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">— Select a task —</option>
                  {allTasks.map((t) => (
                    <option key={t.id} value={t.id}>[{t.status}] {t.title}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Escalation subject <span className="text-red-500">*</span>
                </label>
                <Input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Agent missed SLA by 4 hours on priority batch"
                />
              </div>

              {/* Category + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Severity</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as Priority)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="LOW">Low — monitor only</option>
                    <option value="MEDIUM">Medium — review within 24h</option>
                    <option value="HIGH">High — review within 4h</option>
                    <option value="URGENT">Urgent — immediate action</option>
                  </select>
                </div>
              </div>

              {/* Detailed reason */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Detailed reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  rows={4}
                  placeholder="Describe exactly what happened, when it was noticed, and what the expected behaviour should have been..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {/* Business impact */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Business impact <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={newImpact}
                  onChange={(e) => setNewImpact(e.target.value)}
                  rows={2}
                  placeholder="How does this affect operations, clients, SLA metrics, or revenue?"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {/* Evidence */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Evidence / supporting context <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={newEvidence}
                  onChange={(e) => setNewEvidence(e.target.value)}
                  rows={2}
                  placeholder="Screenshot references, timestamps, agent IDs, chat logs, ticket numbers..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              {/* Assign + Expected resolution */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Assign to supervisor</label>
                  <Input
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    placeholder="Name or email"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Expected resolution (hours)</label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={newExpectedHours}
                    onChange={(e) => setNewExpectedHours(Number(e.target.value))}
                  />
                </div>
              </div>

              {createErr && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {createErr}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button size="sm" disabled={creating} onClick={handleCreate}>
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Raising…
                  </span>
                ) : "Raise escalation"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Escalation queue"
        subtitle="Tasks flagged for immediate supervisor attention."
        action={<Button onClick={openNew}>+ Raise escalation</Button>}
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Open" value={open.length} />
        <StatCard label="Resolved" value={resolved.length} />
        <StatCard label="Overdue" value={overdue.length} />
        <StatCard label="Total" value={escs.length} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | EscStatus)} className="w-40">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
        </Select>
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as "" | Priority)} className="w-40">
          <option value="">All severities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </Select>
        <span className="ml-auto text-xs text-zinc-400">{filtered.length} escalation{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table / empty */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No escalations"
          message="Nothing in the queue. Click 'Raise escalation' to flag a task."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/40">
                <tr>
                  {["Subject", "Category", "Task", "Severity", "Status", "Raised by", "Assigned to", "SLA remaining", "Escalated", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {filtered.map((esc) => {
                  const elapsedH = (Date.now() - new Date(esc.createdAt).getTime()) / 3600000;
                  const remaining = esc.expectedResolutionHours - elapsedH;
                  return (
                    <tr
                      key={esc.id}
                      onClick={() => setDrawer(esc)}
                      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 max-w-[200px] truncate">{esc.subject}</p>
                        <p className="mt-0.5 text-[10px] text-zinc-400 max-w-[200px] truncate">{esc.reason}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{esc.category}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 max-w-[140px] truncate">{esc.taskTitle}</td>
                      <td className="px-4 py-3"><Badge tone={priorityTone(esc.priority)}>{esc.priority}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={statusTone(esc.status)}>{esc.status.replace("_", " ")}</Badge></td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300">{esc.raisedBy}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{esc.assignedTo || <span className="text-zinc-400">—</span>}</td>
                      <td className="px-4 py-3">
                        {esc.status === "RESOLVED" || esc.status === "DISMISSED"
                          ? <span className="text-xs text-zinc-400">—</span>
                          : remaining <= 0
                          ? <Badge tone="danger">Overdue</Badge>
                          : <span className="text-xs text-amber-600">{remaining.toFixed(1)}h left</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{fmtRelative(esc.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); setDrawer(esc); }}
                          className="text-[11px] text-brand-600 hover:underline whitespace-nowrap"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side drawer — detail + actions */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDrawer(null)}>
          <div className="pointer-events-none fixed inset-0 bg-black/30" />
          <div
            className="pointer-events-auto relative z-50 flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{drawer.subject}</h2>
                  <p className="mt-0.5 text-xs text-zinc-400">{fmtDate(drawer.createdAt)} · {drawer.category}</p>
                </div>
                <button onClick={() => setDrawer(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <Badge tone={statusTone(drawer.status)}>{drawer.status.replace("_", " ")}</Badge>
                <Badge tone={priorityTone(drawer.priority)}>{drawer.priority}</Badge>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-5 px-6 py-5">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4 text-xs dark:bg-zinc-800/40">
                <div><span className="text-zinc-400">Task</span><p className="font-medium text-zinc-800 dark:text-zinc-200">{drawer.taskTitle}</p></div>
                <div><span className="text-zinc-400">Raised by</span><p className="font-medium text-zinc-800 dark:text-zinc-200">{drawer.raisedBy}</p></div>
                <div><span className="text-zinc-400">Assigned to</span><p className="font-medium text-zinc-800 dark:text-zinc-200">{drawer.assignedTo || "—"}</p></div>
                <div><span className="text-zinc-400">Expected resolution</span><p className="font-medium text-zinc-800 dark:text-zinc-200">{drawer.expectedResolutionHours}h</p></div>
              </div>

              {/* Reason */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Reason</p>
                <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">{drawer.reason}</p>
              </div>

              {/* Evidence */}
              {drawer.evidence && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Evidence</p>
                  <p className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">{drawer.evidence}</p>
                </div>
              )}

              {/* Actions */}
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                <p className="mb-3 text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Actions</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={actioning || drawer.status === "IN_REVIEW"}
                    onClick={async () => { setActioning(true); await patchEsc(drawer.id, { status: "IN_REVIEW" }); setDrawer((p) => p ? { ...p, status: "IN_REVIEW" } : null); setActioning(false); }}
                  >
                    Mark In Review
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actioning || drawer.status === "RESOLVED"}
                    onClick={async () => { setActioning(true); await patchEsc(drawer.id, { status: "RESOLVED" }); setDrawer((p) => p ? { ...p, status: "RESOLVED" } : null); setActioning(false); }}
                  >
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={actioning}
                    onClick={async () => { setActioning(true); await patchEsc(drawer.id, { status: "DISMISSED" }); setDrawer(null); setActioning(false); }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
