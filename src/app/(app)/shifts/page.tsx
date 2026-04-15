"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { apiGet, apiPost, extractItems } from "@/lib/api";
import type { Agent, Shift } from "@/lib/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekDates(baseDate: Date): string[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const monday = d.getDate() - day + (day === 0 ? -6 : 1);
  return Array.from({ length: 7 }, (_, i) => {
    // Use local date constructor to avoid UTC offset shifting dates
    const dd = new Date(d.getFullYear(), d.getMonth(), monday + i);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, "0");
    const dy = String(dd.getDate()).padStart(2, "0");
    return `${y}-${m}-${dy}`;
  });
}

function fmtWeekRange(dates: string[]): string {
  if (!dates[0] || !dates[6]) return "";
  const fmt = (s: string) => {
    const [, mo, dy] = s.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[Number(mo) - 1]} ${Number(dy)}`;
  };
  const year = dates[0].slice(0, 4);
  return `${fmt(dates[0])} – ${fmt(dates[6])}, ${year}`;
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
        apiGet("/workforce/shifts").catch(() => []),
        apiGet("/agents").catch(() => []),
      ]);
      setShifts(extractItems<any>(s).map((sh: any) => {
        // Backend stores startAt/endAt as ISO datetimes — split into date + time for the grid
        const start = sh.startAt ? new Date(sh.startAt) : null;
        const end = sh.endAt ? new Date(sh.endAt) : null;
        const toLocalDate = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const dy = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${dy}`;
        };
        const toLocalTime = (d: Date) =>
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        return {
          ...sh,
          date: start ? toLocalDate(start) : sh.date ?? "",
          startTime: start ? toLocalTime(start) : sh.startTime ?? "08:00",
          endTime: end ? toLocalTime(end) : sh.endTime ?? "16:00",
          agentName: sh.agent?.user?.name ?? sh.agentName ?? "Unknown",
          role: sh.notes ?? sh.role,
        };
      }));
      setAgents(extractItems<Agent>(ag).map((a: any) => ({
        ...a,
        name: a.user?.name ?? a.name ?? "Unknown",
        status: a.availability === "ONLINE" ? "ONLINE" : a.availability === "BUSY" ? "BUSY" : "OFFLINE",
        skills: a.skills?.map((s: any) => s.skill ?? s) ?? [],
        rating: Number(a.rating ?? 0),
        completedTasks: a.completedTasks ?? 0,
        activeTasks: a.activeTasks ?? 0,
      })));
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
      // Backend expects startAt/endAt as ISO datetimes
      const startAt = new Date(`${newDate}T${newStart}:00`).toISOString();
      const endAt = new Date(`${newDate}T${newEnd}:00`).toISOString();
      await apiPost("/workforce/shifts", { agentId: newAgent, startAt, endAt, notes: newRole || undefined });
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
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{fmtWeekRange(dates)}</span>
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
                  {DAYS.map((d, i) => {
                    const dateStr = dates[i] ?? "";
                    const [, mo, dy] = dateStr.split("-");
                    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                    const label = mo ? `${months[Number(mo) - 1]} ${Number(dy)}` : "";
                    return (
                      <th key={d} className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        {d}<br /><span className="text-[10px] font-normal normal-case text-zinc-400">{label}</span>
                      </th>
                    );
                  })}
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
