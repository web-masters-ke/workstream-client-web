"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { apiGet, extractItems } from "@/lib/api";
import type { Job, JobStatus } from "@/lib/types";
import { fmtDate, fmtMoney } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/export";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | JobStatus>("");
  const [slaFilter, setSlaFilter] = useState<"" | "ON_TRACK" | "AT_RISK" | "BREACHED">("");
  const [costMax, setCostMax] = useState<string>("");

  const load = async () => {
    setError(null);
    try {
      const data = await apiGet<Job[]>("/jobs");
      setJobs(extractItems<Job>(data));
    } catch (e: unknown) {
      setJobs([]);
      setError(e instanceof Error ? e.message : "Failed to load jobs");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((j) => {
      if (q && !j.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (statusFilter && j.status !== statusFilter) return false;
      if (slaFilter && j.slaStatus !== slaFilter) return false;
      if (costMax && (j.costEstimate ?? 0) > Number(costMax)) return false;
      return true;
    });
  }, [jobs, q, statusFilter, slaFilter, costMax]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((j) => j.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const bulkArchive = () => {
    if (!jobs) return;
    setJobs(jobs.map((j) => (selected.has(j.id) ? { ...j, status: "ARCHIVED" as JobStatus } : j)));
    setSelected(new Set());
  };
  const bulkCancel = () => {
    if (!jobs) return;
    setJobs(jobs.map((j) => (selected.has(j.id) ? { ...j, status: "CANCELLED" as JobStatus } : j)));
    setSelected(new Set());
  };
  const duplicate = (job: Job) => {
    if (!jobs) return;
    const copy: Job = { ...job, id: `job-${Date.now()}`, title: `${job.title} (copy)`, status: "DRAFT", completedTaskCount: 0, createdAt: new Date().toISOString(), slaStatus: "ON_TRACK" };
    setJobs([copy, ...jobs]);
  };
  const cloneAsTemplate = (job: Job) => {
    if (!jobs) return;
    const copy: Job = { ...job, id: `tpl-${Date.now()}`, title: `Template: ${job.title}`, status: "DRAFT", isTemplate: true, completedTaskCount: 0, createdAt: new Date().toISOString() };
    setJobs([copy, ...jobs]);
  };
  const exportCsv = () => {
    exportRowsAsCsv(
      "jobs",
      filtered as unknown as Record<string, unknown>[],
      [
        { key: "id" }, { key: "title" }, { key: "status" }, { key: "priority" },
        { key: "slaMinutes" }, { key: "taskCount" }, { key: "completedTaskCount" }, { key: "costEstimate" }, { key: "dueAt" },
      ],
    );
  };

  const columns: Column<Job>[] = [
    {
      key: "select",
      header: "",
      cell: (j) => (
        <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleOne(j.id)} onClick={(e) => e.stopPropagation()} />
      ),
      className: "w-8",
    },
    {
      key: "title",
      header: "Job",
      cell: (j) => (
        <div>
          <Link href={`/jobs/${j.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
            {j.title}
          </Link>
          {j.isTemplate && <Badge tone="info">Template</Badge>}
          {j.tags && j.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {j.tags.map((t) => (
                <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{t}</span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (j) => (
        <Badge tone={j.status === "IN_PROGRESS" ? "warning" : j.status === "COMPLETED" ? "success" : j.status === "DRAFT" ? "default" : j.status === "CANCELLED" || j.status === "ARCHIVED" ? "default" : "info"}>
          {j.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "sla",
      header: "SLA",
      cell: (j) =>
        j.slaStatus ? (
          <Badge tone={j.slaStatus === "BREACHED" ? "danger" : j.slaStatus === "AT_RISK" ? "warning" : "success"}>{j.slaStatus}</Badge>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    { key: "priority", header: "Priority", cell: (j) => j.priority },
    { key: "tasks", header: "Tasks", cell: (j) => `${j.completedTaskCount}/${j.taskCount}` },
    { key: "cost", header: "Cost est.", cell: (j) => (j.costEstimate != null ? fmtMoney(j.costEstimate) : "—") },
    { key: "due", header: "Due", cell: (j) => fmtDate(j.dueAt) },
    {
      key: "actions",
      header: "",
      cell: (j) => (
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => duplicate(j)} className="text-[11px] text-brand-600 hover:underline">Duplicate</button>
          <span className="text-zinc-300">·</span>
          <button onClick={() => cloneAsTemplate(j)} className="text-[11px] text-brand-600 hover:underline">Template</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Manage published and draft jobs across your workspace."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Link href="/jobs/new"><Button size="sm">New job</Button></Link>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input placeholder="Search title" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | JobStatus)}>
            <option value="">All statuses</option>
            {(["DRAFT", "PUBLISHED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "ARCHIVED"] as JobStatus[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select value={slaFilter} onChange={(e) => setSlaFilter(e.target.value as "" | "ON_TRACK" | "AT_RISK" | "BREACHED")}>
            <option value="">All SLA</option>
            <option value="ON_TRACK">On track</option>
            <option value="AT_RISK">At risk</option>
            <option value="BREACHED">Breached</option>
          </Select>
          <Input placeholder="Max cost" type="number" value={costMax} onChange={(e) => setCostMax(e.target.value)} />
          <div className="text-right text-xs text-zinc-500 md:self-center">{filtered.length} of {jobs?.length ?? 0} jobs</div>
        </div>
      </Card>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs dark:border-brand-900 dark:bg-brand-900/20">
          <span>{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={bulkArchive}>Archive</Button>
          <Button size="sm" variant="outline" onClick={bulkCancel}>Cancel</Button>
          <button onClick={toggleAll} className="ml-auto text-[11px] text-brand-600 hover:underline">
            {selected.size === filtered.length ? "Clear" : "Select all"}
          </button>
        </div>
      )}

      {jobs === null && !error && <LoadingState />}
      {error && <ErrorState message={error} onRetry={load} />}
      {jobs && filtered.length === 0 && (
        <EmptyState
          title="No jobs match"
          message="Try clearing filters or create a new job."
          action={<Link href="/jobs/new"><Button>New job</Button></Link>}
        />
      )}
      {jobs && filtered.length > 0 && <DataTable<Job> columns={columns} rows={filtered} rowKey={(r) => r.id} />}
    </div>
  );
}
