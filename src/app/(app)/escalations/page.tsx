"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { apiGet, apiPatch } from "@/lib/api";
import type { Escalation, Member } from "@/lib/types";
import { fmtDate, fmtRelative } from "@/lib/format";

type EscStatus = Escalation["status"];
type Priority = Escalation["priority"];

function priorityTone(p: Priority) {
  return p === "URGENT" ? "danger" : p === "HIGH" ? "warning" : p === "MEDIUM" ? "info" : "default";
}
function statusTone(s: EscStatus) {
  return s === "RESOLVED" ? "success" : s === "IN_REVIEW" ? "warning" : s === "DISMISSED" ? "default" : "danger";
}

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | EscStatus>("");
  const [priorityFilter, setPriorityFilter] = useState<"" | Priority>("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<Escalation | null>(null);
  const [drawerAssign, setDrawerAssign] = useState("");
  const [drawerPriority, setDrawerPriority] = useState<Priority>("MEDIUM");
  const [actioning, setActioning] = useState(false);
  const [bulkAssignTarget, setBulkAssignTarget] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [esc, mem] = await Promise.all([
        apiGet<Escalation[]>("/tasks?status=ON_HOLD"),
        apiGet<Member[]>("/workspaces/members").catch(() => [] as Member[]),
      ]);
      setEscalations(Array.isArray(esc) ? esc : []);
      setMembers(Array.isArray(mem) ? mem : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load escalations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return escalations.filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (priorityFilter && e.priority !== priorityFilter) return false;
      if (assignedFilter && e.assignedTo !== assignedFilter) return false;
      return true;
    });
  }, [escalations, statusFilter, priorityFilter, assignedFilter]);

  const open = escalations.filter((e) => e.status === "OPEN");
  const resolved = escalations.filter((e) => e.status === "RESOLVED");
  const overdue = escalations.filter((e) => {
    if (e.status !== "OPEN") return false;
    const created = new Date(e.createdAt).getTime();
    return Date.now() - created > 24 * 60 * 60 * 1000; // >24h = overdue
  });

  const toggleSelect = (id: string) => setSelected((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.id)));
  };

  const patchEsc = async (id: string, patch: Partial<Escalation>) => {
    try { await apiPatch(`/escalations/${id}`, patch); } catch { /* stub */ }
    setEscalations((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const bulkResolve = async () => {
    const ids = [...selected];
    await Promise.all(ids.map((id) => patchEsc(id, { status: "RESOLVED" })));
    setSelected(new Set());
    setShowBulk(false);
  };
  const bulkReassign = async () => {
    if (!bulkAssignTarget) return;
    const ids = [...selected];
    await Promise.all(ids.map((id) => patchEsc(id, { assignedTo: bulkAssignTarget })));
    setSelected(new Set());
    setShowBulk(false);
  };

  const openDrawer = (esc: Escalation) => {
    setDrawer(esc);
    setDrawerAssign(esc.assignedTo ?? "");
    setDrawerPriority(esc.priority);
  };

  const applyDrawerChanges = async (action: "assign" | "priority" | "resolve" | "cancel") => {
    if (!drawer) return;
    setActioning(true);
    if (action === "assign") await patchEsc(drawer.id, { assignedTo: drawerAssign });
    if (action === "priority") await patchEsc(drawer.id, { priority: drawerPriority });
    if (action === "resolve") {
      await patchEsc(drawer.id, { status: "IN_REVIEW" });
      try { await apiPatch(`/tasks/${drawer.taskId}/transition`, { status: "IN_PROGRESS" }); } catch { /* stub */ }
    }
    if (action === "cancel") await patchEsc(drawer.id, { status: "DISMISSED" });
    setDrawer((prev) => prev ? { ...prev, ...(action === "assign" ? { assignedTo: drawerAssign } : action === "priority" ? { priority: drawerPriority } : action === "resolve" ? { status: "IN_REVIEW" as EscStatus } : { status: "DISMISSED" as EscStatus }) } : null);
    setActioning(false);
  };

  const cols: Column<Escalation>[] = [
    {
      key: "check",
      header: "",
      cell: (e) => (
        <input
          type="checkbox"
          checked={selected.has(e.id)}
          onChange={() => toggleSelect(e.id)}
          onClick={(ev) => ev.stopPropagation()}
          className="h-4 w-4 rounded border-zinc-300 text-brand-600"
        />
      ),
      className: "w-8",
    },
    {
      key: "subject",
      header: "Subject",
      cell: (e) => (
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">{e.subject}</p>
          <p className="mt-0.5 text-[10px] text-zinc-400 line-clamp-1">{e.reason}</p>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      cell: (e) => <Badge tone={priorityTone(e.priority)}>{e.priority}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (e) => <Badge tone={statusTone(e.status)}>{e.status.replace("_", " ")}</Badge>,
    },
    { key: "raised", header: "Raised by", cell: (e) => <span className="text-xs">{e.raisedBy}</span> },
    { key: "assigned", header: "Assigned to", cell: (e) => <span className="text-xs">{e.assignedTo || <span className="text-zinc-400">Unassigned</span>}</span> },
    {
      key: "sla",
      header: "SLA remaining",
      cell: (e) => {
        const created = new Date(e.createdAt).getTime();
        const elapsedH = (Date.now() - created) / 3600000;
        if (e.status === "RESOLVED" || e.status === "DISMISSED") return <span className="text-xs text-zinc-400">—</span>;
        const remaining = 24 - elapsedH;
        if (remaining <= 0) return <Badge tone="danger">Overdue</Badge>;
        return <span className="text-xs text-amber-600">{remaining.toFixed(1)}h</span>;
      },
    },
    {
      key: "when",
      header: "Escalated",
      cell: (e) => <span className="text-xs">{fmtRelative(e.createdAt)}</span>,
    },
    {
      key: "view",
      header: "",
      cell: (e) => (
        <button
          onClick={(ev) => { ev.stopPropagation(); openDrawer(e); }}
          className="text-[11px] text-brand-600 hover:underline whitespace-nowrap"
        >
          Actions
        </button>
      ),
    },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Escalation queue" subtitle="Tasks requiring supervisor attention." />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Open" value={open.length} />
        <StatCard label="Resolved today" value={resolved.length} />
        <StatCard label="Overdue" value={overdue.length} />
        <StatCard label="Total" value={escalations.length} />
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
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </Select>
        <Select value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)} className="w-44">
          <option value="">All assignees</option>
          {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
        </Select>
        <span className="ml-auto text-xs text-zinc-400">{filtered.length} escalation{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/40 px-4 py-2 dark:border-brand-900 dark:bg-brand-900/10">
          <span className="text-xs font-medium text-brand-700 dark:text-brand-300">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setShowBulk(!showBulk)}>Bulk actions</Button>
          {showBulk && (
            <>
              <Button size="sm" variant="outline" onClick={bulkResolve}>Resolve all</Button>
              <div className="flex items-center gap-2">
                <Select value={bulkAssignTarget} onChange={(e) => setBulkAssignTarget(e.target.value)} className="h-8 w-40 text-xs">
                  <option value="">Reassign to...</option>
                  {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </Select>
                {bulkAssignTarget && <Button size="sm" onClick={bulkReassign}>Apply</Button>}
              </div>
            </>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600">Clear</button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No escalations" message="No escalations match your current filters. Your team is on track." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-zinc-300" />
                  </th>
                  {cols.slice(1).map((c) => (
                    <th key={c.key} className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${c.className ?? ""}`}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {filtered.map((esc) => (
                  <tr key={esc.id} onClick={() => openDrawer(esc)} className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                    {cols.map((c) => (
                      <td key={c.key} className={`px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 ${c.className ?? ""}`}>
                        {c.cell(esc)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDrawer(null)}>
          <div className="pointer-events-none fixed inset-0 bg-black/30" />
          <div
            className="pointer-events-auto relative z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-2xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{drawer.subject}</h2>
                <p className="mt-0.5 text-xs text-zinc-400">{fmtDate(drawer.createdAt)}</p>
              </div>
              <button onClick={() => setDrawer(null)} className="ml-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">✕</button>
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex gap-2"><Badge tone={statusTone(drawer.status)}>{drawer.status}</Badge><Badge tone={priorityTone(drawer.priority)}>{drawer.priority}</Badge></div>
              <p><span className="font-medium">Reason:</span> {drawer.reason}</p>
              <p><span className="font-medium">Raised by:</span> {drawer.raisedBy}</p>
              {drawer.assignedTo && <p><span className="font-medium">Assigned to:</span> {drawer.assignedTo}</p>}
            </div>

            {/* Assign */}
            <Card className="mb-3">
              <Label>Assign to supervisor</Label>
              <Select value={drawerAssign} onChange={(e) => setDrawerAssign(e.target.value)} className="mb-2">
                <option value="">Select member...</option>
                {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </Select>
              <Button size="sm" variant="outline" disabled={actioning || !drawerAssign} onClick={() => applyDrawerChanges("assign")}>
                Assign
              </Button>
            </Card>

            {/* Priority */}
            <Card className="mb-3">
              <Label>Change priority</Label>
              <Select value={drawerPriority} onChange={(e) => setDrawerPriority(e.target.value as Priority)} className="mb-2">
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Button size="sm" variant="outline" disabled={actioning} onClick={() => applyDrawerChanges("priority")}>
                Apply priority
              </Button>
            </Card>

            {/* Actions */}
            <div className="mt-auto flex gap-2">
              <Button size="sm" disabled={actioning} onClick={() => applyDrawerChanges("resolve")}>
                Resolve → In Progress
              </Button>
              <Button size="sm" variant="danger" disabled={actioning} onClick={() => { applyDrawerChanges("cancel"); setDrawer(null); }}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
