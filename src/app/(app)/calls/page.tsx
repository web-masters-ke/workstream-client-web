"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { StatCard } from "@/components/StatCard";
import { apiGet } from "@/lib/api";
import type { CallSession } from "@/lib/types";
import { fmtDate, fmtRelative } from "@/lib/format";

type DirectionFilter = "" | "INBOUND" | "OUTBOUND";
type StatusFilter = "" | "COMPLETED" | "MISSED" | "FAILED";

function fmtDuration(s: number): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function avgDuration(calls: CallSession[]): string {
  if (!calls.length) return "—";
  const completed = calls.filter((c) => c.status === "COMPLETED");
  if (!completed.length) return "—";
  const avg = Math.round(completed.reduce((acc, c) => acc + c.durationSeconds, 0) / completed.length);
  return fmtDuration(avg);
}

function exportCSV(calls: CallSession[]) {
  const header = "ID,Task,Participants,Direction,Duration,Status,Started At";
  const rows = calls.map((c) =>
    [c.id, c.taskId || "", c.participants.join("|"), c.direction, fmtDuration(c.durationSeconds), c.status, c.startedAt].join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "calls-export.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirFilter, setDirFilter] = useState<DirectionFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<CallSession[]>("/communication/calls");
      setCalls(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load calls");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (dirFilter && c.direction !== dirFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (dateFrom && c.startedAt < dateFrom) return false;
      if (dateTo && c.startedAt > dateTo + "T23:59:59") return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.participants.some((p) => p.toLowerCase().includes(q)) && !(c.taskId || "").includes(q)) return false;
      }
      return true;
    });
  }, [calls, dirFilter, statusFilter, dateFrom, dateTo, search]);

  const totalCalls = filtered.length;
  const answered = filtered.filter((c) => c.status === "COMPLETED").length;
  const missed = filtered.filter((c) => c.status === "MISSED").length;
  const avg = avgDuration(filtered);

  const cols: Column<CallSession>[] = [
    {
      key: "dir",
      header: "Dir",
      cell: (c) => (
        <span title={c.direction} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${c.direction === "INBOUND" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"}`}>
          {c.direction === "INBOUND" ? "↓" : "↑"}
        </span>
      ),
      className: "w-12",
    },
    {
      key: "from",
      header: "From / To",
      cell: (c) => (
        <div>
          <p className="text-xs text-zinc-500">{c.participants[0] ?? "—"}</p>
          <p className="text-xs text-zinc-400">→ {c.participants[1] ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      cell: (c) => <span className="font-mono text-xs">{fmtDuration(c.durationSeconds)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <Badge tone={c.status === "COMPLETED" ? "success" : c.status === "MISSED" ? "warning" : "danger"}>{c.status}</Badge>,
    },
    {
      key: "type",
      header: "Type",
      cell: (c) => <Badge tone="info">{c.direction}</Badge>,
    },
    {
      key: "started",
      header: "Started at",
      cell: (c) => <span className="text-xs">{fmtDate(c.startedAt, { dateStyle: "short", timeStyle: "short" })}</span>,
    },
    {
      key: "actions",
      header: "",
      cell: (c) => (
        <button
          className="text-[11px] text-brand-600 hover:underline"
          onClick={(e) => { e.stopPropagation(); setExpanded((prev) => prev === c.id ? null : c.id); }}
        >
          {expanded === c.id ? "Collapse" : "Details"}
        </button>
      ),
    },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Call history"
        subtitle="Past call sessions across all tasks."
        action={
          <Button size="sm" variant="outline" onClick={() => exportCSV(filtered)}>
            Export CSV
          </Button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total calls" value={totalCalls} />
        <StatCard label="Answered" value={answered} />
        <StatCard label="Missed" value={missed} />
        <StatCard label="Avg duration" value={avg} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search participant or task ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <Select value={dirFilter} onChange={(e) => setDirFilter(e.target.value as DirectionFilter)} className="w-40">
          <option value="">All directions</option>
          <option value="INBOUND">Inbound</option>
          <option value="OUTBOUND">Outbound</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="w-40">
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="MISSED">Missed</option>
          <option value="FAILED">Failed</option>
        </Select>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <span>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-800 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-800 outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        {(dirFilter || statusFilter || dateFrom || dateTo || search) && (
          <button
            onClick={() => { setDirFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); setSearch(""); }}
            className="text-xs text-red-600 hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-zinc-400">{filtered.length} call{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table + expand rows */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No calls yet"
          message="Start a call from any task to see history here. Call sessions will appear once agents make or receive calls."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900/40">
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${c.className ?? ""}`}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {filtered.map((call) => (
                  <>
                    <tr
                      key={call.id}
                      onClick={() => setExpanded((prev) => prev === call.id ? null : call.id)}
                      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    >
                      {cols.map((c) => (
                        <td key={c.key} className={`px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200 ${c.className ?? ""}`}>
                          {c.cell(call)}
                        </td>
                      ))}
                    </tr>
                    {expanded === call.id && (
                      <tr key={`${call.id}-detail`} className="bg-zinc-50 dark:bg-zinc-900/60">
                        <td colSpan={cols.length} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4 text-xs md:grid-cols-4">
                            <div>
                              <p className="font-semibold text-zinc-500 uppercase mb-1">Participants</p>
                              <ul className="space-y-0.5 text-zinc-700 dark:text-zinc-200">
                                {call.participants.map((p, i) => <li key={i}>{p}</li>)}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-500 uppercase mb-1">Task</p>
                              <p className="text-zinc-700 dark:text-zinc-200">{call.taskId || "—"}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-500 uppercase mb-1">Duration</p>
                              <p className="text-zinc-700 dark:text-zinc-200">{fmtDuration(call.durationSeconds)}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-500 uppercase mb-1">When</p>
                              <p className="text-zinc-700 dark:text-zinc-200">{fmtRelative(call.startedAt)}</p>
                            </div>
                          </div>
                          <div className="mt-3">
                            <button className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1" disabled>
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Play recording (not available)
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
