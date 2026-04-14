"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import type { Agent, Shift } from "@/lib/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekDates(baseDate: Date): string[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d);
    dd.setDate(diff + i);
    return dd.toISOString().slice(0, 10);
  });
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("16:00");
  const [newRole, setNewRole] = useState("");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [s, ag] = await Promise.all([
        apiGet<Shift[]>("/workforce/shifts"),
        apiGet<Agent[]>("/agents").catch(() => [] as Agent[]),
      ]);
      setShifts(Array.isArray(s) ? s : []);
      setAgents(Array.isArray(ag) ? ag : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const base = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);
  const dates = useMemo(() => weekDates(base), [base]);

  const create = async () => {
    if (!newAgent || !newDate) return;
    const agent = agents.find((a) => a.id === newAgent);
    const sh: Shift = {
      id: `sh-${Date.now()}`,
      workspaceId: "",
      agentId: newAgent,
      agentName: agent?.name ?? "Unknown",
      date: newDate,
      startTime: newStart,
      endTime: newEnd,
      role: newRole || undefined,
    };
    try {
      await apiPost("/workforce/shifts", { agentId: newAgent, date: newDate, startTime: newStart, endTime: newEnd, role: newRole || undefined });
    } catch { /* stub */ }
    setShifts((prev) => [...prev, sh]);
    setShowCreate(false);
    setNewAgent("");
    setNewDate("");
  };

  const removeShift = (id: string) => setShifts((prev) => prev.filter((s) => s.id !== id));

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Shift scheduling"
        subtitle="Assign agents to weekly shifts."
        action={<Button size="sm" onClick={() => setShowCreate(true)}>+ Add shift</Button>}
      />

      <div className="mb-4 flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setWeekOffset((o) => o - 1)}>Prev week</Button>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{dates[0]} — {dates[6]}</span>
        <Button size="sm" variant="outline" onClick={() => setWeekOffset((o) => o + 1)}>Next week</Button>
        <Button size="sm" variant="ghost" onClick={() => setWeekOffset(0)}>Today</Button>
      </div>

      {showCreate && (
        <Card className="mb-6 border-brand-200 dark:border-brand-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Create shift</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
            <div>
              <Label>Agent</Label>
              <Select value={newAgent} onChange={(e) => setNewAgent(e.target.value)}>
                <option value="">Select</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div>
              <Label>End</Label>
              <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="KYC" />
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={create}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {agents.length === 0 ? (
        <EmptyState title="No agents loaded" message="Add agents to your pool before scheduling shifts." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Agent</th>
                  {DAYS.map((d, i) => (
                    <th key={d} className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {d}<br /><span className="text-[9px] font-normal text-zinc-400">{dates[i]?.slice(5)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const agentShifts = shifts.filter((s) => s.agentId === agent.id);
                  return (
                    <tr key={agent.id}>
                      <td className="px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">{agent.name}</td>
                      {dates.map((date) => {
                        const sh = agentShifts.find((s) => s.date === date);
                        return (
                          <td key={date} className="px-1 py-2 text-center">
                            {sh ? (
                              <div className="group relative rounded bg-brand-100 px-1 py-1 text-[10px] text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
                                {sh.startTime}–{sh.endTime}
                                {sh.role && <span className="ml-1 text-[9px] text-zinc-400">({sh.role})</span>}
                                <button
                                  onClick={() => removeShift(sh.id)}
                                  className="absolute -right-1 -top-1 hidden h-4 w-4 rounded-full bg-red-500 text-[9px] text-white group-hover:flex items-center justify-center"
                                  title="Remove"
                                >
                                  x
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
