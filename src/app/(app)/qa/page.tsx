"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { apiGet, apiPost } from "@/lib/api";
import type { QaReview, Task } from "@/lib/types";
import { fmtRelative } from "@/lib/format";

// Normalise scores: backend stores 1-5 from seed, form submits 0-100.
// Multiply by 20 if the raw value is ≤ 10 so everything displays on 0-100.
const norm = (s: number) => (s <= 10 ? s * 20 : s);

const DIST_COLORS = ["#22c55e", "#6366f1", "#f59e0b", "#ef4444"];

export default function QaPage() {
  const [reviews, setReviews] = useState<QaReview[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTaskId, setNewTaskId] = useState("");
  const [newScore, setNewScore] = useState(80);
  const [newFeedback, setNewFeedback] = useState("");
  const [dimAccuracy, setDimAccuracy] = useState(80);
  const [dimCommunication, setDimCommunication] = useState(80);
  const [dimSpeed, setDimSpeed] = useState(80);
  const [dimProfessionalism, setDimProfessionalism] = useState(80);
  const [dimAdherence, setDimAdherence] = useState(80);
  const [recommendTraining, setRecommendTraining] = useState(false);
  const [recommendPromotion, setRecommendPromotion] = useState(false);
  const [reviewType, setReviewType] = useState<"STANDARD" | "CALIBRATION" | "DISPUTE">("STANDARD");
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [rawR, rawT] = await Promise.all([
        apiGet<QaReview[] | { items: QaReview[] }>("/qa/reviews").catch(() => ({ items: [] as QaReview[] })),
        apiGet<Task[] | { items: any[] }>("/tasks").catch(() => ({ items: [] })),
      ]);
      const rItems = (Array.isArray(rawR) ? rawR : ((rawR as any)?.items ?? [])) as any[];
      const tItems = Array.isArray(rawT) ? rawT : ((rawT as any)?.items ?? []);
      const mappedReviews: QaReview[] = rItems.map((r: any) => ({
        ...r,
        agentName: r.agent?.user?.name ?? r.agentName ?? "Unknown",
        reviewerName: r.reviewer?.name ?? r.reviewerName ?? "Unknown",
        taskTitle: r.task?.title ?? r.taskTitle,
        feedback: r.feedback ?? r.comment,
      }));
      const mappedTasks: Task[] = tItems.map((task: any) => ({
        ...task,
        assignedAgentId: task.assignments?.[0]?.agent?.id ?? task.assignedAgentId,
        assignedAgentName: task.assignments?.[0]?.agent?.user?.name ?? task.assignedAgentName,
      }));
      setReviews(mappedReviews);
      setTasks(mappedTasks);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load QA reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Stats ──────────────────────────────────────────────
  const normScores = reviews.map((r) => norm(r.score));
  const avgScore = normScores.length > 0 ? Math.round(normScores.reduce((a, b) => a + b, 0) / normScores.length) : 0;
  const passing = normScores.filter((s) => s >= 70).length;
  const failing = normScores.length - passing;

  // ── Chart data ─────────────────────────────────────────
  const scoreTrend = useMemo(() =>
    [...reviews]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((r) => ({
        date: new Date(r.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" }),
        score: norm(r.score),
      })),
    [reviews],
  );

  const scoreDistribution = useMemo(() => [
    { name: "Excellent (≥80)", value: normScores.filter((s) => s >= 80).length },
    { name: "Good (60–79)",    value: normScores.filter((s) => s >= 60 && s < 80).length },
    { name: "Fair (40–59)",    value: normScores.filter((s) => s >= 40 && s < 60).length },
    { name: "Poor (<40)",      value: normScores.filter((s) => s < 40).length },
  ].filter((d) => d.value > 0), [normScores]);

  const dimAverages = useMemo(() => {
    const acc: Record<string, { total: number; count: number }> = {};
    reviews.forEach((r: any) => {
      const c = r.criteria as Record<string, number> | undefined;
      if (!c) return;
      Object.entries(c).forEach(([k, v]) => {
        if (!acc[k]) acc[k] = { total: 0, count: 0 };
        acc[k].total += norm(v);
        acc[k].count++;
      });
    });
    const LABELS: Record<string, string> = {
      accuracy: "Accuracy", tone: "Tone / Communication", speed: "Speed",
      professionalism: "Professionalism", adherence: "SOP Adherence",
      communication: "Communication",
    };
    return Object.entries(acc).map(([k, v]) => ({
      key: k,
      label: LABELS[k] ?? k,
      avg: Math.round(v.total / v.count),
    }));
  }, [reviews]);

  const agentLeaderboard = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    reviews.forEach((r) => {
      if (!map[r.agentId]) map[r.agentId] = { name: r.agentName ?? "Unknown", total: 0, count: 0 };
      map[r.agentId].total += norm(r.score);
      map[r.agentId].count++;
    });
    return Object.values(map)
      .map((v) => ({ name: (v.name ?? "Unknown").split(" ")[0], avg: Math.round(v.total / v.count), reviews: v.count }))
      .sort((a, b) => b.avg - a.avg);
  }, [reviews]);

  // ── Submit ─────────────────────────────────────────────
  const submit = async () => {
    if (!newTaskId) return;
    const task = tasks.find((t) => t.id === newTaskId);
    if (!task?.assignedAgentId) {
      setSubmitErr("This task has no assigned agent. Assign an agent to the task first.");
      return;
    }
    setSubmitErr(null);
    // Backend score is 1-5; convert from 0-100
    const backendScore = Math.max(1, Math.min(5, Math.round(newScore / 20)));
    const criteriaRaw: Record<string, number> = {
      accuracy: Math.round(dimAccuracy / 20),
      communication: Math.round(dimCommunication / 20),
      speed: Math.round(dimSpeed / 20),
      professionalism: Math.round(dimProfessionalism / 20),
      adherence: Math.round(dimAdherence / 20),
    };
    try {
      await apiPost("/qa/reviews", {
        taskId: newTaskId,
        agentId: task.assignedAgentId,
        score: backendScore,
        comment: newFeedback || undefined,
        criteria: criteriaRaw,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message ?? e?.response?.data?.message ?? e?.message ?? "Failed to submit";
      setSubmitErr(msg);
      return;
    }
    const review: QaReview = {
      id: `qa-${Date.now()}`,
      taskId: newTaskId,
      taskTitle: task?.title,
      agentId: task.assignedAgentId,
      agentName: task?.assignedAgentName ?? "Unknown",
      reviewerName: "You",
      score: newScore, // store 0-100 locally for display
      feedback: newFeedback || undefined,
      createdAt: new Date().toISOString(),
    };
    setReviews((prev) => [review, ...prev]);
    setShowNew(false);
    setNewTaskId(""); setNewScore(80); setNewFeedback("");
    setDimAccuracy(80); setDimCommunication(80); setDimSpeed(80); setDimProfessionalism(80); setDimAdherence(80);
    setRecommendTraining(false); setRecommendPromotion(false); setReviewType("STANDARD");
  };

  const cols: Column<QaReview>[] = [
    { key: "task",     header: "Task",     cell: (r) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{r.taskTitle || r.taskId}</span> },
    { key: "agent",    header: "Agent",    cell: (r) => r.agentName },
    { key: "reviewer", header: "Reviewer", cell: (r) => r.reviewerName },
    {
      key: "score", header: "Score",
      cell: (r) => {
        const s = norm(r.score);
        return <Badge tone={s >= 80 ? "success" : s >= 60 ? "warning" : "danger"}>{s}%</Badge>;
      },
    },
    { key: "feedback", header: "Feedback", cell: (r) => r.feedback || "—" },
    { key: "date",     header: "Date",     cell: (r) => fmtRelative(r.createdAt) },
  ];

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Quality assurance"
        subtitle="Review scores, feedback, and agent quality."
        action={<Button size="sm" onClick={() => { setShowNew(true); setSubmitErr(null); }}>+ New review</Button>}
      />

      {/* ── New review form ── */}
      {showNew && (
        <Card className="mb-6 border-brand-200 dark:border-brand-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Submit QA review</h3>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>Task *</Label>
                <Select value={newTaskId} onChange={(e) => setNewTaskId(e.target.value)}>
                  <option value="">Select completed task</option>
                  {tasks.filter((t) => t.status === "COMPLETED").map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Review type</Label>
                <Select value={reviewType} onChange={(e) => setReviewType(e.target.value as typeof reviewType)}>
                  <option value="STANDARD">Standard</option>
                  <option value="CALIBRATION">Calibration session</option>
                  <option value="DISPUTE">Dispute-triggered</option>
                </Select>
              </div>
              <div>
                <Label>Overall score (0–100)</Label>
                <Input type="number" min={0} max={100} value={newScore} onChange={(e) => setNewScore(Number(e.target.value))} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Dimension scores (0–100)</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { label: "Accuracy",      val: dimAccuracy,       set: setDimAccuracy },
                  { label: "Communication", val: dimCommunication,   set: setDimCommunication },
                  { label: "Speed",         val: dimSpeed,          set: setDimSpeed },
                  { label: "Professionalism", val: dimProfessionalism, set: setDimProfessionalism },
                  { label: "SOP Adherence", val: dimAdherence,      set: setDimAdherence },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <Label>{label}</Label>
                    <Input type="number" min={0} max={100} value={val} onChange={(e) => set(Number(e.target.value))} />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">
                Composite: {Math.round((dimAccuracy + dimCommunication + dimSpeed + dimProfessionalism + dimAdherence) / 5)}
              </p>
            </div>

            <div>
              <Label>Feedback <span className="text-zinc-400">(shared with agent)</span></Label>
              <textarea
                value={newFeedback}
                onChange={(e) => setNewFeedback(e.target.value)}
                rows={3}
                placeholder="Detailed feedback for the agent."
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={recommendTraining} onChange={(e) => setRecommendTraining(e.target.checked)} className="rounded" />
                Flag for training
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={recommendPromotion} onChange={(e) => setRecommendPromotion(e.target.checked)} className="rounded" />
                Recommend for promotion
              </label>
            </div>

            {submitErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{submitErr}</p>}
          </div>

          <div className="mt-4 flex gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Button size="sm" onClick={submit} disabled={!newTaskId}>Submit review</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Avg score</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{avgScore}%</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${avgScore}%` }} />
          </div>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Total reviews</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{reviews.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Passing (≥70%)</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-600">{passing}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Failing (&lt;70%)</p>
          <p className="mt-1 text-3xl font-semibold text-red-500">{failing}</p>
        </Card>
      </div>

      {/* ── Charts (only when there are reviews) ── */}
      {reviews.length > 0 && (
        <>
          {/* Row 1: Score trend (full width) */}
          <Card className="mt-6">
            <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Score trend over time</h2>
            <p className="mb-4 text-xs text-zinc-500">Quality score per review, chronologically</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={scoreTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.12)" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tick={{ fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} tick={{ fill: "#94a3b8" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }}
                  formatter={(v) => [`${Number(v)}%`, "Score"]}
                />
                <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} fill="url(#scoreGrad)" dot={{ r: 4, fill: "#6366f1" }} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Row 2: Dimension scores + Distribution donut */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Dimension scores — horizontal progress bars */}
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Dimension averages</h2>
              <p className="mb-4 text-xs text-zinc-500">Average score per evaluation criterion</p>
              {dimAverages.length === 0 ? (
                <p className="text-xs text-zinc-400">Dimension data not available for these reviews.</p>
              ) : (
                <div className="space-y-3">
                  {dimAverages.map((d) => (
                    <div key={d.key}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{d.label}</span>
                        <span className={`font-semibold ${d.avg >= 80 ? "text-emerald-600" : d.avg >= 60 ? "text-amber-500" : "text-red-500"}`}>{d.avg}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${d.avg >= 80 ? "bg-emerald-500" : d.avg >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${d.avg}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Score distribution donut */}
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Score distribution</h2>
              <p className="mb-2 text-xs text-zinc-500">How reviews are spread across quality tiers</p>
              {scoreDistribution.length === 0 ? (
                <p className="text-xs text-zinc-400">Not enough data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={scoreDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      label={({ percent }: { percent?: number }) => `${Math.round((percent ?? 0) * 100)}%`}
                      labelLine={false}
                    >
                      {scoreDistribution.map((_, i) => (
                        <Cell key={i} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [Number(v), "reviews"]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* Row 3: Agent leaderboard — only if we have real agent names */}
          {agentLeaderboard.some((a) => a.name !== "Unknown") && (
            <Card className="mt-4">
              <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agent leaderboard</h2>
              <p className="mb-4 text-xs text-zinc-500">Average QA score per agent</p>
              <div className="space-y-2">
                {agentLeaderboard.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs font-bold text-zinc-400">#{i + 1}</span>
                    <span className="w-24 truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">{a.name}</span>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${a.avg}%` }} />
                      </div>
                    </div>
                    <span className="w-12 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-300">{a.avg}%</span>
                    <span className="w-16 text-right text-[11px] text-zinc-400">{a.reviews} review{a.reviews !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Reviews table ── */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent reviews</h2>
      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" message="Submit a QA review above to get started." />
      ) : (
        <DataTable<QaReview> columns={cols} rows={reviews} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
