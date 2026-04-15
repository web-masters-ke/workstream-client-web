"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { AgentCard } from "@/components/AgentCard";
import { BarCompare } from "@/components/Charts";
import { apiGet, apiPost, extractItems } from "@/lib/api";
import type { Agent } from "@/lib/types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteSkills, setInviteSkills] = useState("");
  const [inviteRate, setInviteRate] = useState("");
  const [inviteContractType, setInviteContractType] = useState<"FREELANCE" | "PART_TIME" | "FULL_TIME">("FREELANCE");
  const [inviteMessage, setInviteMessage] = useState("");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<Agent[]>("/agents");
      setAgents(extractItems<any>(data).map((a: any) => ({
        ...a,
        name: a.user?.name ?? a.name ?? a.user?.email ?? "Unknown",
        email: a.user?.email ?? a.email ?? "",
        status: a.availability === "ONLINE" ? "ONLINE" : a.availability === "BUSY" ? "BUSY" : "OFFLINE",
        skills: a.skills?.map((s: any) => s.skill ?? s) ?? [],
        rating: Number(a.rating ?? 0),
        completedTasks: a.completedTasks ?? 0,
        activeTasks: a.activeTasks ?? 0,
        successRate: Number(a.successRate ?? 0),
        avgHandleTimeMinutes: a.avgHandleTimeMinutes ?? 0,
      })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (q && !(a.name ?? "").toLowerCase().includes(q.toLowerCase()) && !a.skills.some((s) => s.toLowerCase().includes(q.toLowerCase()))) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [agents, q, statusFilter]);

  const toggleFavorite = (id: string) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a)));
  };
  const toggleBlock = (id: string) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, blocked: !a.blocked } : a)));
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await apiPost("/agents/invite", {
        email: inviteEmail.trim(),
        firstName: inviteFirstName || undefined,
        lastName: inviteLastName || undefined,
        phone: invitePhone || undefined,
        skills: inviteSkills.split(",").map((s) => s.trim()).filter(Boolean),
        hourlyRateCents: inviteRate ? Math.round(Number(inviteRate) * 100) : undefined,
        personalMessage: inviteMessage || undefined,
      });
      await load();
    } catch { /* email taken or other error — still close */ }
    setShowInvite(false);
    setInviteEmail("");
    setInvitePhone("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteSkills("");
    setInviteRate("");
    setInviteMessage("");
  };

  const perfData = useMemo(
    () =>
      agents.slice(0, 5).map((a) => ({
        label: (a.name ?? "Unknown").split(" ")[0],
        successRate: Math.round((a.successRate ?? 0) * 100),
        rating: Math.round((a.rating ?? 0) * 20),
        avgTime: a.avgHandleTimeMinutes ?? 0,
      })),
    [agents],
  );

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Agent pool"
        subtitle="Agents assigned to your business."
        action={<Button size="sm" onClick={() => setShowInvite(true)}>Invite agent</Button>}
      />

      {showInvite && (
        <Card className="mb-4 border-brand-200 dark:border-brand-900">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invite agent to your pool</h3>
          <div className="space-y-4">
            {/* Contact info */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>First name</Label>
                <Input value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} placeholder="Jane" />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} placeholder="Doe" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="agent@email.com" />
              </div>
            </div>

            {/* Role & rate */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>Phone</Label>
                <Input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="+254..." />
              </div>
              <div>
                <Label>Expected hourly rate ($)</Label>
                <Input type="number" min={0} value={inviteRate} onChange={(e) => setInviteRate(e.target.value)} placeholder="e.g. 8" />
              </div>
              <div>
                <Label>Contract type</Label>
                <Select value={inviteContractType} onChange={(e) => setInviteContractType(e.target.value as typeof inviteContractType)}>
                  <option value="FREELANCE">Freelance / Gig</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="FULL_TIME">Full-time</option>
                </Select>
              </div>
            </div>

            {/* Skills + message */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>Skills <span className="text-zinc-400">(comma-separated)</span></Label>
                <Input value={inviteSkills} onChange={(e) => setInviteSkills(e.target.value)} placeholder="Customer Support, KYC, Data Entry" />
              </div>
              <div>
                <Label>Personal message <span className="text-zinc-400">(optional)</span></Label>
                <Input value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} placeholder="Hi, we'd love to have you on our team..." />
              </div>
            </div>

            <div className="flex gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Button size="sm" onClick={invite} disabled={!inviteEmail.trim()}>Send invite</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Input placeholder="Search by name or skill" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ONLINE">Online</option>
          <option value="BUSY">Busy</option>
          <option value="OFFLINE">Offline</option>
        </Select>
        <div className="text-right text-xs text-zinc-500 md:self-center">{filtered.length} agents</div>
      </div>

      {filtered.length === 0 && agents.length === 0 ? (
        <EmptyState title="No agents yet" message="Invite agents to your pool to get started." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No agents match" message="Try clearing your search or filter." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((a) => (
            <div key={a.id}>
              <AgentCard agent={a} />
              <div className="mt-1 flex items-center justify-between px-1 text-[11px]">
                <button onClick={() => toggleFavorite(a.id)} className={a.favorite ? "font-medium text-amber-500" : "text-zinc-400 hover:text-amber-500"}>
                  {a.favorite ? "Starred" : "Star"}
                </button>
                <button onClick={() => toggleBlock(a.id)} className={a.blocked ? "font-medium text-red-500" : "text-zinc-400 hover:text-red-500"}>
                  {a.blocked ? "Blocked" : "Block"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {agents.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Performance comparison</h2>
            <BarCompare
              data={perfData}
              bars={[
                { key: "successRate", label: "Success %" },
                { key: "rating", label: "Rating (x20)" },
                { key: "avgTime", label: "Avg time (m)" },
              ]}
            />
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Availability calendar</h2>
            <div className="space-y-2">
              <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-1 text-[10px] uppercase tracking-wide text-zinc-400">
                <div />
                {days.map((d) => <div key={d} className="text-center">{d}</div>)}
              </div>
              {agents.slice(0, 5).map((a) => (
                <div key={a.id} className="grid grid-cols-[120px_repeat(7,1fr)] gap-1 text-xs">
                  <div className="truncate text-zinc-700 dark:text-zinc-200">{a.name}</div>
                  {days.map((d) => (
                    <div key={d} className="h-5 rounded bg-zinc-100 text-center text-[10px] leading-5 text-zinc-400 dark:bg-zinc-800">
                      —
                    </div>
                  ))}
                </div>
              ))}
              <p className="mt-1 text-[10px] text-zinc-400">Shift data available on the Shifts page.</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
