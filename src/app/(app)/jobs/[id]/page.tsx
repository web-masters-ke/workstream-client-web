"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, Textarea } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { apiGet, apiPatch, extractItems } from "@/lib/api";
import type { Job, Task, TaskStatus, ActivityEvent, Agent } from "@/lib/types";
import { fmtDate, fmtMoney, fmtRelative } from "@/lib/format";

function SlaCountdown({ dueAt, slaMinutes }: { dueAt?: string; slaMinutes: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const end = dueAt ? new Date(dueAt).getTime() : 0;
  const rem = end ? Math.max(0, Math.round((end - now) / 60000)) : slaMinutes;
  const pct = dueAt ? Math.max(0, Math.min(100, (rem / slaMinutes) * 100)) : 100;
  const color = pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
        <span>{rem}m remaining</span>
        <span>{slaMinutes}m SLA</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [job, setJob] = useState<Job | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<{ text: string; at: string }[]>([]);
  const [showEscalate, setShowEscalate] = useState(false);

  useEffect(() => {
    if (!id) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [j, t, ag] = await Promise.all([
          apiGet<Job>(`/jobs/${id}`),
          apiGet<Task[]>(`/jobs/${id}/tasks`).catch(() => [] as Task[]),
          apiGet<Agent[]>("/agents").catch(() => [] as Agent[]),
        ]);
        setJob(j);
        setTasks(extractItems<Task>(t));
        setAgents(extractItems<any>(ag).map((a: any) => ({
          ...a,
          name: a.user?.name ?? a.name,
          status: a.availability === "ONLINE" ? "ONLINE" : a.availability === "BUSY" ? "BUSY" : "OFFLINE",
          skills: a.skills?.map((s: any) => s.skill ?? s) ?? [],
          rating: Number(a.rating ?? 0),
        })));
        // Activity is best-effort
        try {
          const ev = await apiGet<ActivityEvent[]>(`/jobs/${id}/activity`);
          setActivity(extractItems<ActivityEvent>(ev));
        } catch {
          setActivity([]);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load job");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!job) return <EmptyState title="Job not found" message="This job does not exist or was deleted." />;

  const pending = tasks.filter((t) => t.status === "PENDING").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const failed = tasks.filter((t) => t.status === "FAILED").length;
  const pctDone = job.taskCount > 0 ? Math.round((job.completedTaskCount / job.taskCount) * 100) : 0;

  const changeTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      await apiPatch(`/tasks/${taskId}`, { status });
    } catch { /* fallback */ }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
  };

  const reassignTask = async (taskId: string, agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    try {
      await apiPatch(`/tasks/${taskId}`, { assignedAgentId: agentId });
    } catch { /* fallback */ }
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assignedAgentId: agentId, assignedAgentName: agent?.name ?? "Unknown", status: t.status === "PENDING" ? "ASSIGNED" : t.status } : t)),
    );
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    setNotes((p) => [{ text: noteText.trim(), at: new Date().toISOString() }, ...p]);
    setNoteText("");
  };

  const billingEstimate = (job.rateAmount ?? 0) * (job.taskCount ?? 0);

  const taskCols: Column<Task>[] = [
    { key: "title", header: "Task", cell: (t) => <Link href={`/tasks/${t.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">{t.title}</Link> },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <Select value={t.status} onChange={(e) => changeTaskStatus(t.id, e.target.value as TaskStatus)} className="h-7 w-auto text-[11px]">
          {(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"] as TaskStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      ),
    },
    {
      key: "agent",
      header: "Agent",
      cell: (t) => (
        <Select value={t.assignedAgentId ?? ""} onChange={(e) => reassignTask(t.id, e.target.value)} className="h-7 w-auto text-[11px]">
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      ),
    },
    { key: "priority", header: "Priority", cell: (t) => <Badge tone={t.priority === "URGENT" ? "danger" : t.priority === "HIGH" ? "warning" : "default"}>{t.priority}</Badge> },
    { key: "sla", header: "SLA", cell: (t) => `${t.slaMinutes}m` },
    { key: "qa", header: "QA", cell: (t) => t.qaScore != null ? `${t.qaScore}%` : "—" },
  ];

  return (
    <div>
      <PageHeader
        title={job.title}
        subtitle={`Created ${fmtDate(job.createdAt)} · Due ${fmtDate(job.dueAt)}`}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowEscalate((p) => !p)}>Escalate</Button>
            <Button size="sm" variant="outline" onClick={() => router.push(`/jobs/new?from=${job.id}`)}>Duplicate</Button>
            <Badge tone={job.slaStatus === "BREACHED" ? "danger" : job.slaStatus === "AT_RISK" ? "warning" : "success"}>
              {job.slaStatus ?? "—"}
            </Badge>
            <Badge tone={job.status === "IN_PROGRESS" ? "warning" : job.status === "COMPLETED" ? "success" : "info"}>
              {job.status.replace("_", " ")}
            </Badge>
          </div>
        }
      />

      {showEscalate && (
        <Card className="mb-4 border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Escalation triggered for this job.</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">A supervisor will be notified. You can track this under Escalations.</p>
          <Button size="sm" className="mt-2" onClick={() => setShowEscalate(false)}>Dismiss</Button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Total tasks" value={job.taskCount} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="In progress" value={inProgress} />
        <StatCard label="Completed" value={completed} trend={{ value: pctDone, positive: true }} hint={`${pctDone}% done`} />
        <StatCard label="Failed" value={failed} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">SLA countdown</h3>
          <SlaCountdown dueAt={job.dueAt} slaMinutes={job.slaMinutes} />
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Progress</h3>
          <div className="mb-1 flex justify-between text-[11px] text-zinc-500">
            <span>{job.completedTaskCount} of {job.taskCount}</span>
            <span>{pctDone}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div className="h-3 rounded-full bg-brand-600 transition-all" style={{ width: `${pctDone}%` }} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Description</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{job.description}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-zinc-400">Rate type:</span> <span className="font-medium text-zinc-700 dark:text-zinc-200">{job.rateType ?? "—"}</span></div>
            <div><span className="text-zinc-400">Rate:</span> <span className="font-medium text-zinc-700 dark:text-zinc-200">{job.rateAmount != null ? fmtMoney(job.rateAmount) : "—"}</span></div>
          </div>
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Billing estimate</h3>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{fmtMoney(billingEstimate)}</p>
          <p className="mt-1 text-xs text-zinc-500">{job.taskCount} tasks x {fmtMoney(job.rateAmount ?? 0)} / {job.rateType ?? "task"}</p>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tasks in this job</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No tasks yet.</p>
      ) : (
        <DataTable<Task> columns={taskCols} rows={tasks} rowKey={(r) => r.id} />
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Notes</h3>
          <div className="flex gap-2">
            <Input placeholder="Add a note" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            <Button size="sm" onClick={addNote}>Add</Button>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            {notes.map((n, i) => (
              <li key={i} className="rounded border border-zinc-100 p-2 dark:border-zinc-800">
                <p className="text-zinc-700 dark:text-zinc-200">{n.text}</p>
                <p className="mt-1 text-[10px] text-zinc-400">{fmtRelative(n.at)}</p>
              </li>
            ))}
            {notes.length === 0 && <p className="text-zinc-400">No notes yet.</p>}
          </ul>
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Activity</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-zinc-400">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {activity.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span className="text-zinc-700 dark:text-zinc-200">
                    <span className="font-medium">{e.actorName}</span> {e.message}
                  </span>
                  <span className="text-zinc-400">{fmtRelative(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
