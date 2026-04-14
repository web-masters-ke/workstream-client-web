"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, ErrorState, Input, LoadingState, PageHeader } from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { LineTrend, BarCompare, DonutBreakdown, LineSeries } from "@/components/Charts";
import { apiGet } from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/export";
import { fmtMoney } from "@/lib/format";
import type { Agent, Job, Task } from "@/lib/types";

type Range = "7d" | "14d" | "30d" | "90d";

interface AnalyticsData {
  tasksTotal?: number;
  tasksCompleted?: number;
  tasksFailed?: number;
  avgSlaMinutes?: number;
  agentUtilization?: number;
  slaCompliancePct?: number;
  taskTrend?: { label: string; completed: number; failed: number }[];
  costTrend?: { label: string; cost: number }[];
}

export default function ReportsPage() {
  const [range, setRange] = useState<Range>("7d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsData>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [an, j, ag, t] = await Promise.all([
        apiGet<AnalyticsData>(`/analytics/overview?period=${range}`).catch(() => ({} as AnalyticsData)),
        apiGet<Job[]>("/jobs").catch(() => [] as Job[]),
        apiGet<Agent[]>("/agents").catch(() => [] as Agent[]),
        apiGet<Task[]>("/tasks").catch(() => [] as Task[]),
      ]);
      setAnalytics(an ?? {});
      setJobs(Array.isArray(j) ? j : []);
      setAgents(Array.isArray(ag) ? ag : []);
      setTasks(Array.isArray(t) ? t : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [range]);

  const total = analytics.tasksTotal ?? tasks.length;
  const completed = analytics.tasksCompleted ?? tasks.filter((t) => t.status === "COMPLETED").length;
  const failed = analytics.tasksFailed ?? tasks.filter((t) => t.status === "FAILED").length;
  const avgSla = analytics.avgSlaMinutes ?? (tasks.length > 0 ? Math.round(tasks.reduce((acc, t) => acc + t.slaMinutes, 0) / tasks.length) : 0);
  const utilization = analytics.agentUtilization ?? 0;
  const slaCompliance = analytics.slaCompliancePct ?? (jobs.length > 0 ? Math.round(((jobs.length - jobs.filter((j) => j.slaStatus === "BREACHED").length) / jobs.length) * 100) : 100);

  const taskTrend = useMemo(
    () =>
      analytics.taskTrend && analytics.taskTrend.length > 0
        ? analytics.taskTrend
        : [],
    [analytics],
  );

  const costTrend = useMemo(
    () =>
      analytics.costTrend && analytics.costTrend.length > 0
        ? analytics.costTrend
        : [],
    [analytics],
  );

  const statusBreakdown = useMemo(
    () => [
      { name: "Completed", value: completed },
      { name: "In progress", value: tasks.filter((t) => t.status === "IN_PROGRESS").length },
      { name: "Failed", value: failed },
      { name: "Pending", value: tasks.filter((t) => t.status === "PENDING").length },
    ],
    [tasks, completed, failed],
  );

  const agentComparison = useMemo(
    () =>
      agents.map((a) => ({
        label: a.name.split(" ")[0],
        success: Math.round(a.successRate * 100),
        completed: Math.round(a.completedTasks / 50),
        avgTime: a.avgHandleTimeMinutes ?? 15,
      })),
    [agents],
  );

  const exportReport = () => {
    exportRowsAsCsv(
      "report",
      tasks as unknown as Record<string, unknown>[],
      [{ key: "id" }, { key: "title" }, { key: "status" }, { key: "priority" }, { key: "assignedAgentName" }, { key: "slaMinutes" }, { key: "createdAt" }],
    );
  };

  const exportPdfStub = () => {
    window.alert("PDF export coming soon. For now, use CSV export.");
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        subtitle="Performance of your workspace operations."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportReport}>Export CSV</Button>
            <Button size="sm" variant="outline" onClick={exportPdfStub}>Export PDF</Button>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="flex gap-1">
            {(["7d", "14d", "30d", "90d"] as Range[]).map((r) => (
              <Button key={r} size="sm" variant={range === r ? "primary" : "outline"} onClick={() => setRange(r)}>{r}</Button>
            ))}
          </div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="Start" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="End" />
          <div className="md:col-span-2 text-right text-xs text-zinc-500 md:self-center">
            Showing data for {range} range
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total tasks" value={total} />
        <StatCard label="Completed" value={completed} />
        <StatCard label="Failed" value={failed} />
        <StatCard label="SLA compliance" value={`${slaCompliance}%`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard label="Avg SLA" value={`${avgSla}m`} hint="Average across all tasks" />
        <StatCard label="Agent utilization" value={utilization} hint="Avg active tasks per agent" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Task completion trend</h2>
          {taskTrend.length === 0 ? (
            <p className="text-sm text-zinc-400">No trend data available for this period.</p>
          ) : (
            <LineSeries data={taskTrend} lines={[{ key: "completed", label: "Completed" }, { key: "failed", label: "Failed" }]} />
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Status breakdown</h2>
          <DonutBreakdown data={statusBreakdown} />
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Cost analysis</h2>
          {costTrend.length === 0 ? (
            <p className="text-sm text-zinc-400">No cost data available for this period.</p>
          ) : (
            <>
              <LineTrend data={costTrend} dataKey="cost" />
              <p className="mt-2 text-xs text-zinc-500">
                Total spend: <span className="font-semibold text-zinc-800 dark:text-zinc-100">{fmtMoney(costTrend.reduce((s, c) => s + (c.cost as number), 0))}</span>
              </p>
            </>
          )}
        </Card>
        {agents.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agent comparison</h2>
            <BarCompare
              data={agentComparison}
              bars={[{ key: "success", label: "Success %" }, { key: "completed", label: "Tasks (/50)" }, { key: "avgTime", label: "Avg time (m)" }]}
            />
          </Card>
        )}
      </div>

      {jobs.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Job completion progress</h2>
          <div className="space-y-3">
            {jobs.map((j) => {
              const pct = j.taskCount === 0 ? 0 : Math.round((j.completedTaskCount / j.taskCount) * 100);
              return (
                <div key={j.id}>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-700 dark:text-zinc-300">{j.title}</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {agents.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top performing agents</h2>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[...agents]
              .sort((a, b) => b.successRate - a.successRate)
              .slice(0, 5)
              .map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{a.name}</p>
                    <p className="text-xs text-zinc-500">{a.completedTasks} completed · {a.avgHandleTimeMinutes ?? "—"}m avg</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{Math.round(a.successRate * 100)}%</span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
