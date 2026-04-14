"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Badge, Button, Card, Input, Label, LoadingState, PageHeader, Select, Textarea } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { apiGet, apiPost } from "@/lib/api";
import { parseCsv } from "@/lib/export";
import type { Job } from "@/lib/types";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface TaskDef {
  title: string;
  count: number;
  skill?: string;
}

type RateType = "PER_TASK" | "PER_MINUTE" | "PER_OUTCOME";

const TEMPLATES = [
  { label: "KYC batch", title: "KYC onboarding batch", desc: "KYC review + welcome call for each customer.", tasks: [{ title: "KYC review", count: 40 }, { title: "Welcome call", count: 40 }], sla: 60, priority: "HIGH", skills: ["KYC", "Voice"] },
  { label: "Ticket triage", title: "Ticket triage", desc: "Classify and respond to support tickets.", tasks: [{ title: "Triage ticket", count: 100 }], sla: 30, priority: "MEDIUM", skills: ["Support"] },
  { label: "Call campaign", title: "Outbound call campaign", desc: "Make calls to accounts.", tasks: [{ title: "Outbound call", count: 80 }], sla: 240, priority: "LOW", skills: ["Voice"] },
];

export default function NewJobPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading wizard..." />}>
      <NewJobContent />
    </Suspense>
  );
}

function NewJobContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams?.get("from");

  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [taskDefs, setTaskDefs] = useState<TaskDef[]>([{ title: "", count: 1 }]);
  const [slaMinutes, setSlaMinutes] = useState(60);
  const [assignment, setAssignment] = useState<"AUTO" | "MANUAL" | "SKILL_BASED">("AUTO");
  const [rateType, setRateType] = useState<RateType>("PER_TASK");
  const [rateAmount, setRateAmount] = useState(1.0);
  const [recurring, setRecurring] = useState(false);
  const [recurCron, setRecurCron] = useState("0 8 * * MON");
  const [recurStart, setRecurStart] = useState("");
  const [recurEnd, setRecurEnd] = useState("");
  const [qaEnabled, setQaEnabled] = useState(false);
  const [qaPercent, setQaPercent] = useState(20);
  const [qaMinScore, setQaMinScore] = useState(70);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If cloning from an existing job, fetch it from the API
  useEffect(() => {
    if (!fromId) return;
    apiGet<Job>(`/jobs/${fromId}`).then((src) => {
      if (!src) return;
      setTitle(src.title + " (copy)");
      setDescription(src.description);
      setPriority(src.priority);
      setSlaMinutes(src.slaMinutes);
      if (src.rateType) setRateType(src.rateType);
      if (src.rateAmount != null) setRateAmount(src.rateAmount);
    }).catch(() => {});
  }, [fromId]);

  const applyTemplate = (idx: number) => {
    const t = TEMPLATES[idx];
    setTitle(t.title);
    setDescription(t.desc);
    setPriority(t.priority);
    setSlaMinutes(t.sla);
    setTaskDefs(t.tasks.map((tk) => ({ ...tk, skill: t.skills[0] })));
    setStep(2);
  };

  const addTaskDef = () => setTaskDefs((prev) => [...prev, { title: "", count: 1 }]);
  const updateTaskDef = (idx: number, patch: Partial<TaskDef>) =>
    setTaskDefs((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  const removeTaskDef = (idx: number) => setTaskDefs((prev) => prev.filter((_, i) => i !== idx));

  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      const rows = parseCsv(text);
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const importCsv = () => {
    if (!csvPreview) return;
    const imported = csvPreview.map((row) => ({
      title: row.title || row.Title || row.name || row.Name || Object.values(row)[0] || "Untitled",
      count: Number(row.count || row.Count || row.quantity || 1) || 1,
      skill: row.skill || row.Skill || undefined,
    }));
    setTaskDefs(imported);
    setCsvPreview(null);
    setStep(2);
  };

  const next = () => setStep((s) => (Math.min(6, s + 1) as Step));
  const prev = () => setStep((s) => (Math.max(1, s - 1) as Step));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiPost("/jobs", {
        title, description, priority, slaMinutes, assignment,
        rateType, rateAmount,
        recurring: recurring ? { cron: recurCron, startDate: recurStart || undefined, endDate: recurEnd || undefined } : undefined,
        qa: qaEnabled ? { samplePercent: qaPercent, minScore: qaMinScore } : undefined,
        tasks: taskDefs,
      });
      router.push("/jobs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  }

  const totalTasks = taskDefs.reduce((s, t) => s + t.count, 0);
  const estCost = totalTasks * rateAmount;

  const stepLabels = ["Basics", "Tasks", "SLA & rate", "Assignment", "QA rules", "Review"];

  return (
    <div>
      <PageHeader title="Create new job" subtitle="Step-by-step wizard." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {stepLabels.map((l, i) => (
          <button
            key={l}
            onClick={() => setStep((i + 1) as Step)}
            className={`flex h-7 items-center rounded-full px-3 text-xs font-medium transition ${
              step >= i + 1
                ? "bg-brand-600 text-white"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {i + 1}. {l}
          </button>
        ))}
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 && (
            <>
              <div>
                <Label>Template (optional)</Label>
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {TEMPLATES.map((t, i) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => applyTemplate(i)}
                      className="rounded-lg border border-zinc-200 p-3 text-left text-xs hover:border-brand-400 dark:border-zinc-700 dark:hover:border-brand-600"
                    >
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{t.label}</p>
                      <p className="mt-1 text-zinc-500">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Customer onboarding batch" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea required value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                  <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="rounded" />
                  Recurring schedule
                </label>
                {recurring && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <Label>Cron expression</Label>
                      <Input value={recurCron} onChange={(e) => setRecurCron(e.target.value)} placeholder="0 8 * * MON" />
                    </div>
                    <div>
                      <Label>Start date</Label>
                      <Input type="date" value={recurStart} onChange={(e) => setRecurStart(e.target.value)} />
                    </div>
                    <div>
                      <Label>End date</Label>
                      <Input type="date" value={recurEnd} onChange={(e) => setRecurEnd(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Define tasks that will be generated from this job.</p>
                <div className="flex gap-2">
                  <label className="cursor-pointer rounded border border-zinc-200 px-3 py-1 text-[11px] font-medium text-brand-600 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    Import CSV
                    <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCsvUpload} />
                  </label>
                </div>
              </div>

              {csvPreview && (
                <Card className="border-brand-200 bg-brand-50/40 dark:border-brand-900 dark:bg-brand-900/10">
                  <h3 className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-50">CSV preview ({csvPreview.length} rows)</h3>
                  <div className="max-h-56 overflow-auto rounded border border-zinc-200 dark:border-zinc-700">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          {csvPreview[0] && Object.keys(csvPreview[0]).map((k) => (
                            <th key={k} className="bg-zinc-100 px-2 py-1 text-left font-medium dark:bg-zinc-800">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(0, 10).map((row, ri) => (
                          <tr key={ri}>
                            {Object.values(row).map((v, ci) => (
                              <td key={ci} className="px-2 py-1 text-zinc-700 dark:text-zinc-200">{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button type="button" size="sm" onClick={importCsv}>Use these rows</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setCsvPreview(null)}>Cancel</Button>
                  </div>
                </Card>
              )}

              {taskDefs.map((t, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Task title</Label>
                    <Input value={t.title} onChange={(e) => updateTaskDef(idx, { title: e.target.value })} placeholder="KYC review" />
                  </div>
                  <div className="w-28">
                    <Label>Count</Label>
                    <Input type="number" min={1} value={t.count} onChange={(e) => updateTaskDef(idx, { count: Number(e.target.value) })} />
                  </div>
                  <div className="w-32">
                    <Label>Skill</Label>
                    <Input value={t.skill ?? ""} onChange={(e) => updateTaskDef(idx, { skill: e.target.value })} placeholder="Any" />
                  </div>
                  {taskDefs.length > 1 && (
                    <Button type="button" variant="ghost" onClick={() => removeTaskDef(idx)}>Remove</Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addTaskDef}>+ Add task definition</Button>
              <p className="text-xs text-zinc-500">Total tasks: {totalTasks}</p>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>SLA (minutes per task)</Label>
                <Input type="number" min={5} value={slaMinutes} onChange={(e) => setSlaMinutes(Number(e.target.value))} />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Tasks breaching SLA will trigger alerts.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rate type</Label>
                  <Select value={rateType} onChange={(e) => setRateType(e.target.value as RateType)}>
                    <option value="PER_TASK">Per task</option>
                    <option value="PER_MINUTE">Per minute</option>
                    <option value="PER_OUTCOME">Per outcome</option>
                  </Select>
                </div>
                <div>
                  <Label>Rate amount ($)</Label>
                  <Input type="number" step="0.01" min={0} value={rateAmount} onChange={(e) => setRateAmount(Number(e.target.value))} />
                </div>
              </div>
              <p className="text-xs text-zinc-500">Estimated cost: <span className="font-semibold">${(estCost).toFixed(2)}</span> for {totalTasks} tasks</p>
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <Label>Assignment strategy</Label>
                <Select value={assignment} onChange={(e) => setAssignment(e.target.value as typeof assignment)}>
                  <option value="AUTO">Auto — round-robin online agents</option>
                  <option value="SKILL_BASED">Skill-based routing</option>
                  <option value="MANUAL">Manual assignment by supervisor</option>
                </Select>
              </div>
              {assignment === "SKILL_BASED" && (
                <p className="text-xs text-zinc-500">Skills from task definitions will be matched against agent skill tags.</p>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={qaEnabled} onChange={(e) => setQaEnabled(e.target.checked)} className="rounded" />
                Enable QA review on completed tasks
              </label>
              {qaEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Sample % of tasks to QA</Label>
                    <Input type="number" min={1} max={100} value={qaPercent} onChange={(e) => setQaPercent(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Min passing score (%)</Label>
                    <Input type="number" min={0} max={100} value={qaMinScore} onChange={(e) => setQaMinScore(Number(e.target.value))} />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 6 && (
            <>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Review</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-zinc-400">Title:</span> <span className="font-medium text-zinc-800 dark:text-zinc-100">{title || "—"}</span></div>
                <div><span className="text-zinc-400">Priority:</span> {priority}</div>
                <div><span className="text-zinc-400">Tasks:</span> {totalTasks}</div>
                <div><span className="text-zinc-400">SLA:</span> {slaMinutes}m</div>
                <div><span className="text-zinc-400">Rate:</span> ${rateAmount} / {rateType.toLowerCase().replace("_", " ")}</div>
                <div><span className="text-zinc-400">Assignment:</span> {assignment}</div>
                <div><span className="text-zinc-400">Recurring:</span> {recurring ? recurCron : "No"}</div>
                <div><span className="text-zinc-400">QA:</span> {qaEnabled ? `${qaPercent}% sample, min ${qaMinScore}%` : "Off"}</div>
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Estimated cost: <span className="text-brand-600">${estCost.toFixed(2)}</span></p>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}

          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={prev} disabled={step === 1}>Back</Button>
            {step < 6 ? (
              <Button type="button" onClick={next}>Continue</Button>
            ) : (
              <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create job"}</Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
