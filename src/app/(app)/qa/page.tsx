"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { BarCompare, DonutBreakdown } from "@/components/Charts";
import { apiGet, apiPost } from "@/lib/api";
import type { QaReview, Task } from "@/lib/types";
import { fmtRelative } from "@/lib/format";

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

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [r, t] = await Promise.all([
        apiGet<QaReview[]>("/qa/reviews"),
        apiGet<Task[]>("/tasks?status=COMPLETED").catch(() => [] as Task[]),
      ]);
      setReviews(Array.isArray(r) ? r : []);
      setTasks(Array.isArray(t) ? t : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load QA reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const avgScore = reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + r.score, 0) / reviews.length) : 0;
  const passing = reviews.filter((r) => r.score >= 70).length;
  const failing = reviews.length - passing;

  const agentScores = useMemo(() => {
    const map: Record<string, { total: number; count: number; name: string }> = {};
    reviews.forEach((r) => {
      if (!map[r.agentId]) map[r.agentId] = { total: 0, count: 0, name: r.agentName };
      map[r.agentId].total += r.score;
      map[r.agentId].count++;
    });
    return Object.entries(map).map(([, v]) => ({ label: v.name.split(" ")[0], avg: Math.round(v.total / v.count), count: v.count }));
  }, [reviews]);

  const scoreBreakdown = useMemo(
    () => [
      { name: "Excellent (90+)", value: reviews.filter((r) => r.score >= 90).length || 0 },
      { name: "Good (70-89)", value: reviews.filter((r) => r.score >= 70 && r.score < 90).length || 0 },
      { name: "Below (< 70)", value: reviews.filter((r) => r.score < 70).length || 0 },
    ],
    [reviews],
  );

  const submit = async () => {
    if (!newTaskId) return;
    const task = tasks.find((t) => t.id === newTaskId);
    const compositeScore = Math.round((dimAccuracy + dimCommunication + dimSpeed + dimProfessionalism + dimAdherence) / 5);
    const finalScore = newScore; // supervisor can override
    try {
      await apiPost("/qa/reviews", {
        taskId: newTaskId,
        score: finalScore,
        feedback: newFeedback || undefined,
        reviewType,
        dimensions: { accuracy: dimAccuracy, communication: dimCommunication, speed: dimSpeed, professionalism: dimProfessionalism, adherence: dimAdherence },
        compositeScore,
        recommendTraining,
        recommendPromotion,
      });
    } catch { /* stub */ }
    const review: QaReview = {
      id: `qa-${Date.now()}`,
      taskId: newTaskId,
      taskTitle: task?.title,
      agentId: task?.assignedAgentId ?? "unknown",
      agentName: task?.assignedAgentName ?? "Unknown",
      reviewerName: "You",
      score: finalScore,
      feedback: newFeedback || undefined,
      createdAt: new Date().toISOString(),
    };
    setReviews((prev) => [review, ...prev]);
    setShowNew(false);
    setNewTaskId("");
    setNewScore(80);
    setNewFeedback("");
    setDimAccuracy(80); setDimCommunication(80); setDimSpeed(80); setDimProfessionalism(80); setDimAdherence(80);
    setRecommendTraining(false); setRecommendPromotion(false);
    setReviewType("STANDARD");
  };

  const cols: Column<QaReview>[] = [
    { key: "task", header: "Task", cell: (r) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{r.taskTitle || r.taskId}</span> },
    { key: "agent", header: "Agent", cell: (r) => r.agentName },
    { key: "reviewer", header: "Reviewer", cell: (r) => r.reviewerName },
    {
      key: "score",
      header: "Score",
      cell: (r) => <Badge tone={r.score >= 80 ? "success" : r.score >= 50 ? "warning" : "danger"}>{r.score}%</Badge>,
    },
    { key: "feedback", header: "Feedback", cell: (r) => r.feedback || "—" },
    { key: "date", header: "Date", cell: (r) => fmtRelative(r.createdAt) },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Quality assurance"
        subtitle="Review scores, feedback, and agent quality."
        action={<Button size="sm" onClick={() => setShowNew(true)}>+ New review</Button>}
      />

      {showNew && (
        <Card className="mb-6 border-brand-200 dark:border-brand-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Submit QA review</h3>
          <div className="mt-4 space-y-4">
            {/* Row 1: Task + Review type + Overall score */}
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

            {/* Row 2: Dimension scores */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Dimension scores</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { label: "Accuracy", val: dimAccuracy, set: setDimAccuracy },
                  { label: "Communication", val: dimCommunication, set: setDimCommunication },
                  { label: "Speed", val: dimSpeed, set: setDimSpeed },
                  { label: "Professionalism", val: dimProfessionalism, set: setDimProfessionalism },
                  { label: "SOP Adherence", val: dimAdherence, set: setDimAdherence },
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

            {/* Row 3: Feedback */}
            <div>
              <Label>Feedback <span className="text-zinc-400">(shared with agent)</span></Label>
              <textarea
                value={newFeedback}
                onChange={(e) => setNewFeedback(e.target.value)}
                rows={3}
                placeholder="Detailed feedback for the agent. Be specific about what was done well and what needs improvement."
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>

            {/* Row 4: Flags */}
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
          </div>

          <div className="mt-4 flex gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <Button size="sm" onClick={submit} disabled={!newTaskId}>Submit review</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Avg score</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{avgScore}%</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Reviews</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{reviews.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Passing</p>
          <p className="mt-1 text-3xl font-semibold text-emerald-600">{passing}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase text-zinc-500">Failing</p>
          <p className="mt-1 text-3xl font-semibold text-red-600">{failing}</p>
        </Card>
      </div>

      {reviews.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agent scores</h2>
            <BarCompare data={agentScores} bars={[{ key: "avg", label: "Avg score" }, { key: "count", label: "Reviews" }]} />
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Score distribution</h2>
            <DonutBreakdown data={scoreBreakdown} />
          </Card>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent reviews</h2>
      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" message="Submit a QA review above to get started." />
      ) : (
        <DataTable<QaReview> columns={cols} rows={reviews} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
