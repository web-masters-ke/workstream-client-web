"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, Badge, Button, ErrorState, LoadingState } from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { LineTrend, DonutBreakdown, BarCompare } from "@/components/Charts";
import { apiGet } from "@/lib/api";
import type { Task, Agent, Job } from "@/lib/types";
import { fmtRelative, fmtMoney } from "@/lib/format";

interface AnalyticsSummary {
  period?: string;
  tasks?: { total: number; completed: number; open: number; completionRate: number };
  tasksCompleted?: number;
  tasksTrend?: { label: string; value: number }[];
  revenue?: number;
  walletBalance?: number;
  currency?: string;
  agents?: number;
  businesses?: number;
}

export default function OverviewPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({});
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [t, a, j] = await Promise.all([
        apiGet<Task[] | { items: Task[] }>(`/tasks?limit=50`).catch(() => [] as Task[]),
        apiGet<Agent[] | { items: Agent[] }>("/agents?limit=50").catch(() => [] as Agent[]),
        apiGet<Job[] | { items: Job[] }>("/jobs?limit=50").catch(() => [] as Job[]),
      ]);
      const taskArr  = Array.isArray(t) ? t : (t as any)?.items ?? [];
      const agentArr = Array.isArray(a) ? a : (a as any)?.items ?? [];
      const jobArr   = Array.isArray(j) ? j : (j as any)?.items ?? [];
      setTasks(taskArr);
      setAgents(agentArr);
      setJobs(jobArr);
      try {
        const an = await apiGet<AnalyticsSummary>(`/analytics/overview?period=${period}`);
        setAnalytics(an ?? {});
      } catch { setAnalytics({}); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const pending    = tasks.filter((t) => t.status === "PENDING").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completed  = tasks.filter((t) => t.status === "COMPLETED").length;
  const failed     = tasks.filter((t) => t.status === "FAILED").length;
  const cancelled  = tasks.filter((t) => t.status === "CANCELLED").length;
  const total      = tasks.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const failureRate    = total > 0 ? Math.round((failed / total) * 100) : 0;
  const online  = agents.filter((a) => a.status === "ONLINE").length;
  const busy    = agents.filter((a) => a.status === "BUSY").length;
  const offline = agents.filter((a) => a.status === "OFFLINE").length;
  const avgRating = agents.length > 0 ? (agents.reduce((s, a) => s + Number(a.rating ?? 0), 0) / agents.length).toFixed(1) : "—";
  const avgSuccessRate = agents.length > 0 ? Math.round((agents.reduce((s, a) => s + Number(a.successRate ?? 0), 0) / agents.length) * 100) : 0;

  const slaBreached = jobs.filter((j) => j.slaStatus === "BREACHED");
  const slaAtRisk   = jobs.filter((j) => j.slaStatus === "AT_RISK");

  // ── Chart data ─────────────────────────────────────────────────────────────
  const taskTrend = useMemo(() => {
    if (analytics.tasksTrend && analytics.tasksTrend.length > 0) return analytics.tasksTrend;
    return Array.from({ length: 7 }, (_, i) => ({ label: `D${i + 1}`, value: 0 }));
  }, [analytics]);

  const statusBreakdown = useMemo(() => [
    { name: "Pending",     value: pending     || 0 },
    { name: "In progress", value: inProgress  || 0 },
    { name: "Completed",   value: completed   || 0 },
    { name: "Failed",      value: failed      || 0 },
    { name: "Cancelled",   value: cancelled   || 0 },
  ].filter((s) => s.value > 0), [pending, inProgress, completed, failed, cancelled]);

  const agentStatusBreakdown = useMemo(() => [
    { name: "Online",  value: online  || 0 },
    { name: "Busy",    value: busy    || 0 },
    { name: "Offline", value: offline || 0 },
  ].filter((s) => s.value > 0), [online, busy, offline]);

  const agentPerf = useMemo(() => {
    return [...agents]
      .sort((a, b) => Number(b.successRate ?? 0) - Number(a.successRate ?? 0))
      .slice(0, 7)
      .map((a) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dn: string = (a as any).fullName ?? (a as any).firstName ?? a.name ?? a.email ?? "Agent";
        return {
          label:       dn.split(" ")[0],
          successRate: Math.round(Number(a.successRate ?? 0) * 100),
          rating:      Math.round(Number(a.rating ?? 0) * 20),
          tasks:       a.completedTasks ?? 0,
        };
      });
  }, [agents]);

  const priorityBreakdown = useMemo(() => {
    const counts = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});
    return [
      { name: "Low",    value: counts["LOW"]    || 0 },
      { name: "Medium", value: counts["MEDIUM"] || 0 },
      { name: "High",   value: counts["HIGH"]   || 0 },
      { name: "Urgent", value: counts["URGENT"] || 0 },
    ].filter((p) => p.value > 0);
  }, [tasks]);

  const jobStatusBar = useMemo(() =>
    (["PUBLISHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((s) => ({
      label: s.replace("_", " "),
      count: jobs.filter((j) => j.status === s).length,
    })),
  [jobs]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace overview"
        subtitle="Live snapshot of your operations."
        action={
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <Link href="/jobs/new"><Button size="sm">+ New job</Button></Link>
          </div>
        }
      />

      {/* ── Top KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Pending"       value={pending}          hint="Awaiting assignment" />
        <StatCard label="In progress"   value={inProgress}       hint="Actively being worked" />
        <StatCard label="Completed"     value={completed}        hint="Done this period" />
        <StatCard label="Failed"        value={failed}           hint="Did not complete" />
        <StatCard label="Completion %"  value={`${completionRate}%`} hint="Tasks finished / total" />
        <StatCard label="Failure rate"  value={`${failureRate}%`}    hint="Failed / total" />
        <StatCard label="Agents online" value={`${online}/${agents.length}`} hint={`${busy} busy · ${offline} offline`} />
        <StatCard label="Avg rating"    value={avgRating}        hint={`Team avg success: ${avgSuccessRate}%`} />
      </div>

      {/* ── SLA alert banner ─────────────────────────────────────────────── */}
      {(slaBreached.length > 0 || slaAtRisk.length > 0) && (
        <Card className="border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600 dark:text-red-400">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">SLA alerts</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/70">
                  {slaBreached.length} breached · {slaAtRisk.length} at risk
                </p>
              </div>
            </div>
            <Link href="/escalations" className="text-xs font-medium text-red-700 hover:underline dark:text-red-300">
              Review →
            </Link>
          </div>
          {[...slaBreached, ...slaAtRisk].slice(0, 3).length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-red-100 pt-3 dark:border-red-900/40">
              {[...slaBreached, ...slaAtRisk].slice(0, 3).map((j) => (
                <li key={j.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-zinc-700 dark:text-zinc-200">{j.title}</span>
                  <Badge tone={j.slaStatus === "BREACHED" ? "danger" : "warning"}>{j.slaStatus}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ── Row 1: Trend + Task status donut + Agent status donut ─────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tasks completed over time</h2>
            <Link href="/reports" className="text-xs text-brand-600 hover:underline">Full report</Link>
          </div>
          <LineTrend data={taskTrend} dataKey="value" />
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Task status</h2>
          {statusBreakdown.length === 0
            ? <p className="text-xs text-zinc-400">No tasks yet.</p>
            : <DonutBreakdown data={statusBreakdown} />
          }
        </Card>

        <Card className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agent availability</h2>
          {agentStatusBreakdown.length === 0
            ? <p className="text-xs text-zinc-400">No agents yet.</p>
            : <DonutBreakdown data={agentStatusBreakdown} />
          }
        </Card>
      </div>

      {/* ── Row 2: Agent performance bar + Priority breakdown ─────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agent performance comparison</h2>
            <Link href="/agents" className="text-xs text-brand-600 hover:underline">All agents</Link>
          </div>
          {agentPerf.length === 0
            ? <p className="text-xs text-zinc-400">No agents loaded.</p>
            : <BarCompare
                data={agentPerf}
                bars={[
                  { key: "successRate", label: "Success %" },
                  { key: "rating",      label: "Rating ×20" },
                ]}
              />
          }
        </Card>

        <Card className="lg:col-span-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tasks by priority</h2>
          {priorityBreakdown.length === 0
            ? <p className="text-xs text-zinc-400">No tasks yet.</p>
            : (
            <div className="space-y-2.5">
              {priorityBreakdown.map(({ name, value }) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">{name}</span>
                    <span className="text-zinc-400">{value} tasks · {total > 0 ? Math.round((value/total)*100) : 0}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-2 rounded-full ${name === "Urgent" ? "bg-red-500" : name === "High" ? "bg-amber-500" : name === "Medium" ? "bg-brand-500" : "bg-zinc-400"}`}
                      style={{ width: `${total > 0 ? Math.round((value/total)*100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Job status mini breakdown */}
          {jobs.length > 0 && (
            <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Jobs by status</p>
              <div className="flex flex-wrap gap-2">
                {jobStatusBar.filter((s) => s.count > 0).map((s) => (
                  <div key={s.label} className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {s.label}: <span className="font-bold">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: Recent tasks + Top agents ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent tasks</h2>
            <Link href="/tasks" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-zinc-400">No tasks yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {tasks.slice(0, 8).map((t) => {
                const overdue = t.dueAt && new Date(t.dueAt) < new Date() && !["COMPLETED","CANCELLED","FAILED"].includes(t.status);
                return (
                  <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{t.title}</p>
                      <p className="text-xs text-zinc-400">
                        {t.assignedAgentName ?? "Unassigned"} · {fmtRelative(t.createdAt)}
                        {overdue && <span className="ml-1 font-medium text-red-500">Overdue</span>}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-1.5 shrink-0">
                      <Badge tone={
                        t.priority === "URGENT" ? "danger" :
                        t.priority === "HIGH"   ? "warning" : "default"
                      }>{t.priority}</Badge>
                      <Badge tone={
                        t.status === "COMPLETED"  ? "success" :
                        t.status === "IN_PROGRESS" ? "warning" :
                        t.status === "FAILED"      ? "danger"  : "default"
                      }>{t.status.replace("_", " ")}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top agents</h2>
            <Link href="/agents" className="text-xs text-brand-600 hover:underline">All agents</Link>
          </div>
          {agents.length === 0 ? (
            <p className="text-sm text-zinc-400">No agents yet. <Link href="/agents" className="text-brand-600 hover:underline">Invite one.</Link></p>
          ) : (
            <div className="space-y-3">
              {[...agents]
                .sort((a, b) => Number(b.successRate ?? 0) - Number(a.successRate ?? 0))
                .slice(0, 5)
                .map((a, i) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const dn: string = (a as any).fullName ?? (a as any).firstName ?? a.name ?? a.email ?? "Agent";
                  const pct = Math.round(Number(a.successRate ?? 0) * 100);
                  const initials = dn.split(" ").map((p: string) => p[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
                  const dot = a.status === "ONLINE" ? "bg-emerald-500" : a.status === "BUSY" ? "bg-amber-400" : "bg-zinc-300";
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-zinc-300 dark:text-zinc-600 w-4">#{i + 1}</span>
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">{dn}</p>
                        <div className="mt-0.5 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{pct}%</span>
                      <span className={clsx("h-2 w-2 rounded-full shrink-0", dot)} />
                    </div>
                  );
                })
              }
            </div>
          )}

          {/* Revenue / wallet */}
          {(analytics.revenue != null || analytics.walletBalance != null) && (
            <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              {analytics.revenue != null && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-500">Revenue this period</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{fmtMoney(analytics.revenue, analytics.currency ?? "USD")}</p>
                </div>
              )}
              {analytics.walletBalance != null && (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-zinc-500">Wallet balance</p>
                  <p className="text-sm font-semibold text-emerald-600">{fmtMoney(analytics.walletBalance, analytics.currency ?? "USD")}</p>
                </div>
              )}
              <Link href="/billing" className="mt-2 inline-block text-[11px] font-medium text-brand-600 hover:underline">Manage billing →</Link>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Completion rate health ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Completion rate</p>
          <p className="mt-2 text-4xl font-bold text-zinc-900 dark:text-zinc-50">{completionRate}<span className="text-lg text-zinc-400">%</span></p>
          <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-2 rounded-full ${completionRate >= 80 ? "bg-emerald-500" : completionRate >= 60 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${completionRate}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">{completed} of {total} tasks</p>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Agent utilisation</p>
          <p className="mt-2 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {agents.length > 0 ? Math.round(((online + busy) / agents.length) * 100) : 0}<span className="text-lg text-zinc-400">%</span>
          </p>
          <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-2 rounded-full bg-brand-500"
              style={{ width: agents.length > 0 ? `${Math.round(((online + busy) / agents.length) * 100)}%` : "0%" }} />
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">{online + busy} active of {agents.length}</p>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">SLA health</p>
          <p className="mt-2 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {jobs.length > 0 ? Math.round(((jobs.length - slaBreached.length) / jobs.length) * 100) : 100}<span className="text-lg text-zinc-400">%</span>
          </p>
          <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-2 rounded-full ${slaBreached.length === 0 ? "bg-emerald-500" : slaBreached.length < 3 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: jobs.length > 0 ? `${Math.round(((jobs.length - slaBreached.length) / jobs.length) * 100)}%` : "100%" }} />
          </div>
          <p className="mt-1 text-[10px] text-zinc-400">{slaBreached.length} breached · {slaAtRisk.length} at risk</p>
        </Card>
      </div>
    </div>
  );
}

// local clsx helper (imported at top in real — add if missing)
function clsx(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
