"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select } from "@/components/ui";
import { TaskCard } from "@/components/TaskCard";
import { DataTable, Column } from "@/components/DataTable";
import { apiGet, apiPatch } from "@/lib/api";
import type { Agent, Task, TaskStatus } from "@/lib/types";
import { onRealtime } from "@/lib/socket";
import { fmtRelative } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/export";

type View = "kanban" | "list";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("kanban");
  const [q, setQ] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAgent, setBulkAgent] = useState("");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [t, ag] = await Promise.all([
        apiGet<Task[]>("/tasks"),
        apiGet<Agent[]>("/agents").catch(() => [] as Agent[]),
      ]);
      setTasks(Array.isArray(t) ? t : []);
      setAgents(Array.isArray(ag) ? ag : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const off = onRealtime((ev) => {
      if (ev.type === "task.status_changed") {
        setTasks((prev) =>
          prev.map((t) => (t.id === ev.payload.taskId ? { ...t, status: ev.payload.status as TaskStatus } : t)),
        );
      }
    });
    return off;
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (agentFilter && t.assignedAgentId !== agentFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (skillFilter && t.skill !== skillFilter) return false;
      return true;
    });
  }, [tasks, q, agentFilter, statusFilter, priorityFilter, skillFilter]);

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, Task[]> = {
      PENDING: [], ASSIGNED: [], IN_PROGRESS: [], COMPLETED: [], FAILED: [], CANCELLED: [],
    };
    filtered.forEach((t) => g[t.status].push(t));
    return g;
  }, [filtered]);

  const allSkills = useMemo(() => Array.from(new Set(tasks.map((t) => t.skill).filter(Boolean) as string[])), [tasks]);

  const toggleSelected = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const bulkReassign = async () => {
    if (!bulkAgent || selected.size === 0) return;
    const agent = agents.find((a) => a.id === bulkAgent);
    for (const id of selected) {
      try { await apiPatch(`/tasks/${id}`, { assignedAgentId: bulkAgent }); } catch { /* fallback */ }
    }
    setTasks((prev) =>
      prev.map((t) =>
        selected.has(t.id)
          ? { ...t, assignedAgentId: bulkAgent, assignedAgentName: agent?.name ?? "Unknown", status: t.status === "PENDING" ? "ASSIGNED" : t.status }
          : t,
      ),
    );
    setSelected(new Set());
  };

  const exportCsv = () => {
    exportRowsAsCsv(
      "tasks",
      filtered as unknown as Record<string, unknown>[],
      [{ key: "id" }, { key: "title" }, { key: "status" }, { key: "priority" }, { key: "assignedAgentName" }, { key: "skill" }, { key: "slaMinutes" }, { key: "createdAt" }],
    );
  };

  const tableCols: Column<Task>[] = [
    {
      key: "select",
      header: "",
      cell: (t) => <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSelected(t.id)} onClick={(e) => e.stopPropagation()} />,
      className: "w-8",
    },
    {
      key: "title",
      header: "Task",
      cell: (t) => (
        <div>
          <Link href={`/tasks/${t.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">{t.title}</Link>
          {t.jobTitle && <p className="text-[10px] text-zinc-400">{t.jobTitle}</p>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => {
        const toneMap: Record<TaskStatus, "default" | "info" | "warning" | "success" | "danger"> = { PENDING: "default", ASSIGNED: "info", IN_PROGRESS: "warning", COMPLETED: "success", FAILED: "danger", CANCELLED: "default" };
        return <Badge tone={toneMap[t.status]}>{t.status.replace("_", " ")}</Badge>;
      },
    },
    { key: "agent", header: "Agent", cell: (t) => t.assignedAgentName || <span className="text-zinc-400">Unassigned</span> },
    { key: "priority", header: "Priority", cell: (t) => t.priority },
    { key: "skill", header: "Skill", cell: (t) => t.skill || "—" },
    { key: "sla", header: "SLA", cell: (t) => `${t.slaMinutes}m` },
    { key: "failed", header: "Failed reason", cell: (t) => t.failedReason || "—" },
    { key: "created", header: "Created", cell: (t) => fmtRelative(t.createdAt) },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Task board"
        subtitle="Live view of all tasks in this workspace."
        action={
          <div className="flex gap-2">
            <Button variant={view === "kanban" ? "primary" : "outline"} size="sm" onClick={() => setView("kanban")}>Kanban</Button>
            <Button variant={view === "list" ? "primary" : "outline"} size="sm" onClick={() => setView("list")}>List</Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All status</option>
            {(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"] as TaskStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All priority</option>
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
            <option value="">All skills</option>
            {allSkills.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <div className="text-right text-xs text-zinc-500 md:self-center">{filtered.length} tasks</div>
        </div>
      </Card>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs dark:border-brand-900 dark:bg-brand-900/20">
          <span>{selected.size} selected</span>
          <Select value={bulkAgent} onChange={(e) => setBulkAgent(e.target.value)} className="ml-2 h-7 w-auto text-[11px]">
            <option value="">Reassign to...</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Button size="sm" variant="outline" onClick={bulkReassign} disabled={!bulkAgent}>Reassign</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-[11px] text-brand-600 hover:underline">Clear</button>
        </div>
      )}

      {tasks.length === 0 && (
        <EmptyState title="No tasks yet" message="Tasks will appear here once jobs are published and running." />
      )}

      {tasks.length > 0 && view === "kanban" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="rounded-xl bg-zinc-100/60 p-3 dark:bg-zinc-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{col.label}</h3>
                <span className="text-xs text-zinc-500">{grouped[col.key].length}</span>
              </div>
              <div className="space-y-2">
                {grouped[col.key].map((t) => <TaskCard key={t.id} task={t} />)}
                {grouped[col.key].length === 0 && (
                  <p className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400 dark:border-zinc-700">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tasks.length > 0 && view === "list" && (
        <DataTable<Task> columns={tableCols} rows={filtered} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
