"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorState, LoadingState, PageHeader, Input, Label, Select } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { apiGet, apiPost, apiDelete, apiPatch, extractItems, WORKSPACE_KEY } from "@/lib/api";
import type { Member, UserRole, Workspace } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { usePresence } from "@/lib/presence";

const ROLES: UserRole[] = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "BILLING", "VIEWER"];

const PERMS = [
  { key: "manageTeam",     label: "Manage team" },
  { key: "manageBilling",  label: "Billing" },
  { key: "createJobs",     label: "Create jobs" },
  { key: "viewReports",    label: "View reports" },
  { key: "manageSettings", label: "Settings" },
  { key: "manageAgents",   label: "Manage agents" },
];

type PermMatrix = Record<string, Record<string, boolean>>;
const DEFAULT_MATRIX: PermMatrix = {
  OWNER:      { manageTeam: true,  manageBilling: true,  createJobs: true,  viewReports: true,  manageSettings: true,  manageAgents: true },
  ADMIN:      { manageTeam: true,  manageBilling: true,  createJobs: true,  viewReports: true,  manageSettings: true,  manageAgents: true },
  SUPERVISOR: { manageTeam: false, manageBilling: false, createJobs: true,  viewReports: true,  manageSettings: false, manageAgents: true },
  MEMBER:     { manageTeam: false, manageBilling: false, createJobs: true,  viewReports: false, manageSettings: false, manageAgents: false },
  BILLING:    { manageTeam: false, manageBilling: true,  createJobs: false, viewReports: true,  manageSettings: false, manageAgents: false },
  VIEWER:     { manageTeam: false, manageBilling: false, createJobs: false, viewReports: true,  manageSettings: false, manageAgents: false },
};

// ── "Create Team" drawer state ──────────────────────────────────────────────
interface NewTeamForm {
  name: string;
  description: string;
  timezone: string;
  currency: string;
  language: string;
  categories: string;         // comma-separated
  slaLow: string;             // minutes
  slaMedium: string;
  slaHigh: string;
  slaUrgent: string;
  escalationAfter: string;    // minutes
  shiftStart: string;         // HH:mm
  shiftEnd: string;
  workDays: string[];
  maxTasksPerAgent: string;
  requireTaskNotes: boolean;
  autoAssign: boolean;
}

const BLANK_FORM: NewTeamForm = {
  name: "", description: "", timezone: "Africa/Nairobi", currency: "KES",
  language: "en", categories: "",
  slaLow: "480", slaMedium: "240", slaHigh: "60", slaUrgent: "15",
  escalationAfter: "30",
  shiftStart: "08:00", shiftEnd: "17:00",
  workDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  maxTasksPerAgent: "5",
  requireTaskNotes: false,
  autoAssign: true,
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─────────────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  // ── Teams ──────────────────────────────────────────────────────────────────
  const [teams, setTeams] = useState<Workspace[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [form, setForm] = useState<NewTeamForm>(BLANK_FORM);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [teamErr, setTeamErr] = useState<string | null>(null);

  // ── Members ─────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  // ── Add member drawer ───────────────────────────────────────────────────────
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("SUPERVISOR");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [memberErr, setMemberErr] = useState<string | null>(null);

  // ── Permission matrix ───────────────────────────────────────────────────────
  const [showPerms, setShowPerms] = useState(false);
  const [matrix, setMatrix] = useState<PermMatrix>(DEFAULT_MATRIX);
  const [matrixSaved, setMatrixSaved] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedId = typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_KEY) : null;
    if (savedId) setActiveTeamId(savedId);
    try {
      const raw = localStorage.getItem("ws-permission-matrix");
      if (raw) setMatrix(JSON.parse(raw));
    } catch { /* noop */ }
    loadTeams(savedId);
    loadMembers();
  }, []);

  async function loadTeams(currentId?: string | null) {
    try {
      const data = await apiGet<Workspace[]>("/workspaces");
      const arr = extractItems<Workspace>(data);
      setTeams(arr);
      if (!currentId && arr.length > 0) {
        setActiveTeamId(arr[0].id);
        if (typeof window !== "undefined") localStorage.setItem(WORKSPACE_KEY, arr[0].id);
      }
    } catch { /* noop */ }
  }

  async function loadMembers() {
    setMembersError(null);
    setLoadingMembers(true);
    try {
      const data = await apiGet<Member[]>("/team");
      setMembers(
        extractItems<any>(data).map((m: any) => ({
          ...m,
          name: m.user?.name ?? [m.user?.firstName, m.user?.lastName].filter(Boolean).join(" ") ?? m.name ?? "Unknown",
          email: m.user?.email ?? m.email ?? "",
          status: m.user?.status ?? m.status ?? "ACTIVE",
        }))
      );
    } catch (e: unknown) {
      setMembersError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  }

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const set = (k: keyof NewTeamForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k: keyof NewTeamForm) => () => setForm((p) => ({ ...p, [k]: !p[k] }));
  const toggleDay = (d: string) =>
    setForm((p) => ({
      ...p,
      workDays: p.workDays.includes(d) ? p.workDays.filter((x) => x !== d) : [...p.workDays, d],
    }));

  // ── Create team ─────────────────────────────────────────────────────────────
  async function createTeam(e: FormEvent) {
    e.preventDefault();
    setTeamErr(null);
    setCreatingTeam(true);
    try {
      const cats = form.categories.split(",").map((c) => c.trim()).filter(Boolean);
      const res = await apiPost<any>("/workspaces", {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        timezone: form.timezone,
        currency: form.currency,
        categories: cats,
        slaDefaults: {
          low: Number(form.slaLow),
          medium: Number(form.slaMedium),
          high: Number(form.slaHigh),
          urgent: Number(form.slaUrgent),
        },
      });
      const newTeam: Workspace = {
        id: res?.id ?? `ws-${Date.now()}`,
        businessId: res?.businessId ?? "",
        name: res?.name ?? form.name,
        slug: res?.slug ?? form.name.toLowerCase().replace(/\s+/g, "-"),
        timezone: form.timezone,
        description: res?.description ?? form.description,
        categories: res?.categories ?? cats,
        currency: form.currency,
        slaDefaults: { low: Number(form.slaLow), medium: Number(form.slaMedium), high: Number(form.slaHigh), urgent: Number(form.slaUrgent) },
        createdAt: res?.createdAt ?? new Date().toISOString(),
        memberCount: 0,
      };
      setTeams((prev) => [...prev, newTeam]);
      switchTeam(newTeam.id);
      setForm(BLANK_FORM);
      setTeamDrawerOpen(false);
    } catch (err: unknown) {
      setTeamErr(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  }

  function switchTeam(id: string) {
    setActiveTeamId(id);
    if (typeof window !== "undefined") localStorage.setItem(WORKSPACE_KEY, id);
  }

  async function deleteTeam(id: string) {
    try { await apiDelete(`/workspaces/${id}`); } catch { /* noop */ }
    setTeams((prev) => prev.filter((t) => t.id !== id));
    if (activeTeamId === id) {
      const rem = teams.filter((t) => t.id !== id);
      if (rem.length > 0) switchTeam(rem[0].id);
      else setActiveTeamId(null);
    }
  }

  // ── Add member ──────────────────────────────────────────────────────────────
  function openMemberDrawer() {
    setFirstName(""); setLastName(""); setEmail(""); setPhone("");
    setRole("SUPERVISOR"); setPersonalMessage(""); setMemberErr(null);
    setSelectedTeamId(activeTeamId ?? teams[0]?.id ?? "");
    setMemberDrawerOpen(true);
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    setMemberErr(null);
    setSavingMember(true);
    try {
      const res = await apiPost<any>("/team/invites", {
        email, firstName: firstName || undefined, lastName: lastName || undefined,
        phone: phone || undefined, personalMessage: personalMessage || undefined,
        role, workspaceId: selectedTeamId || undefined,
      });
      const name = [firstName, lastName].filter(Boolean).join(" ") || email;
      setMembers((prev) => [{
        id: res?.id ?? `m-${Date.now()}`,
        userId: res?.userId ?? "",
        workspaceId: selectedTeamId ?? "",
        name: res?.user?.name ?? name,
        email: res?.user?.email ?? email,
        role: (res?.role ?? role) as UserRole,
        status: "ACTIVE",
        joinedAt: res?.invitedAt ?? new Date().toISOString(),
      }, ...prev]);
      setMemberDrawerOpen(false);
    } catch (err: unknown) {
      setMemberErr(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSavingMember(false);
    }
  }

  // ── Permissions ─────────────────────────────────────────────────────────────
  const togglePerm = (r: string, p: string) => {
    if (r === "OWNER") return;
    setMatrix((prev) => ({ ...prev, [r]: { ...prev[r], [p]: !prev[r]?.[p] } }));
    setMatrixSaved(false);
  };
  const saveMatrix = () => {
    localStorage.setItem("ws-permission-matrix", JSON.stringify(matrix));
    setMatrixSaved(true);
    setTimeout(() => setMatrixSaved(false), 2000);
  };

  // ── Columns ─────────────────────────────────────────────────────────────────
  const visibleMembers = activeTeamId
    ? members.filter((m) => !m.workspaceId || m.workspaceId === activeTeamId)
    : members;

  const removeMember = async (id: string) => {
    try { await apiDelete(`/team/${id}`); } catch { /* noop */ }
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };
  const updateRole = async (id: string, newRole: UserRole) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: newRole } : m)));
    try { await apiPatch(`/team/${id}`, { role: newRole }); } catch { /* noop */ }
  };

  const { isOnline } = usePresence();

  const columns: Column<Member>[] = [
    {
      key: "name", header: "Name",
      cell: (m) => (
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            {(m.name || m.email || "?")[0].toUpperCase()}
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 ${isOnline(m.userId) ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
          </div>
          <div>
            <div className="font-medium text-zinc-900 dark:text-zinc-50">{m.name}</div>
            <div className="text-[11px] text-zinc-400">{m.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "team", header: "Team",
      cell: (m) => {
        const team = teams.find((t) => t.id === m.workspaceId);
        return team ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            {team.name}
          </span>
        ) : (
          <span className="text-[11px] text-zinc-400">—</span>
        );
      },
    },
    {
      key: "role", header: "Role",
      cell: (m) => (
        <Select value={m.role} onChange={(e) => updateRole(m.id, e.target.value as UserRole)} className="h-7 w-auto text-[11px]">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      ),
    },
    { key: "status", header: "Status", cell: (m) => <Badge tone={m.status === "ACTIVE" ? "success" : "info"}>{m.status}</Badge> },
    { key: "joined", header: "Added", cell: (m) => fmtDate(m.joinedAt, { dateStyle: "medium" }) },
    {
      key: "actions", header: "",
      cell: (m) => m.role !== "OWNER" ? (
        <button onClick={() => removeMember(m.id)} className="text-[11px] text-red-500 hover:underline">Remove</button>
      ) : null,
    },
  ];

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Manage your teams and their members."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowPerms((p) => !p)}>Permissions</Button>
            <Button size="sm" onClick={openMemberDrawer}>+ Add member</Button>
          </div>
        }
      />

      {/* ── Teams row ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Teams</h2>
          <button
            onClick={() => { setForm(BLANK_FORM); setTeamErr(null); setTeamDrawerOpen(true); }}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:border-brand-400 hover:text-brand-600 dark:border-zinc-700 dark:hover:border-brand-500 dark:hover:text-brand-400 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New team
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <div
              key={t.id}
              onClick={() => switchTeam(t.id)}
              className={`group relative flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all select-none
                ${activeTeamId === t.id
                  ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                }`}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold
                ${activeTeamId === t.id ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className={`text-sm font-semibold ${activeTeamId === t.id ? "text-brand-700 dark:text-brand-300" : "text-zinc-800 dark:text-zinc-100"}`}>
                  {t.name}
                </div>
                <div className="text-[10px] text-zinc-400">
                  {members.filter((m) => !m.workspaceId || m.workspaceId === t.id).length} members
                  {t.timezone && ` · ${t.timezone}`}
                </div>
              </div>
              {teams.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTeam(t.id); }}
                  className="ml-1 hidden rounded p-0.5 text-zinc-300 hover:text-red-500 group-hover:block dark:text-zinc-600"
                  title="Delete team"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-zinc-400">No teams yet — create your first one.</p>
          )}
        </div>
      </div>

      {/* ── Permissions ────────────────────────────────────────────────────────── */}
      {showPerms && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Role permissions</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">Click to toggle. OWNER is locked.</p>
            </div>
            <div className="flex items-center gap-2">
              {matrixSaved && <span className="text-[11px] text-emerald-600">Saved</span>}
              <Button size="sm" variant="outline" onClick={() => { setMatrix(structuredClone(DEFAULT_MATRIX)); localStorage.setItem("ws-permission-matrix", JSON.stringify(DEFAULT_MATRIX)); }}>Reset</Button>
              <Button size="sm" onClick={saveMatrix}>Save</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="pb-2 pr-4 text-left font-medium text-zinc-500">Role</th>
                  {PERMS.map((p) => <th key={p.key} className="pb-2 px-3 text-center font-medium text-zinc-500 whitespace-nowrap">{p.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                    <td className="py-2.5 pr-4 font-semibold text-zinc-800 dark:text-zinc-100">
                      {r}{r === "OWNER" && <span className="ml-1.5 text-[10px] font-normal text-zinc-400">locked</span>}
                    </td>
                    {PERMS.map((p) => {
                      const checked = matrix[r]?.[p.key] ?? false;
                      const locked = r === "OWNER";
                      return (
                        <td key={p.key} className="py-2.5 px-3 text-center">
                          <button type="button" disabled={locked} onClick={() => togglePerm(r, p.key)}
                            className={`inline-flex h-5 w-5 items-center justify-center rounded transition
                              ${locked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"}
                              ${checked ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600"}`}>
                            {checked
                              ? <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            }
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Members table ─────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {activeTeamId ? `Members · ${teams.find((t) => t.id === activeTeamId)?.name ?? ""}` : "All members"}
          <span className="ml-2 text-xs font-normal text-zinc-400">({visibleMembers.length})</span>
        </h2>
      </div>

      {loadingMembers ? <LoadingState /> : membersError ? (
        <ErrorState message={membersError} onRetry={loadMembers} />
      ) : visibleMembers.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">No members in this team yet</p>
          <p className="mt-1 text-xs text-zinc-400">Click &ldquo;+ Add member&rdquo; to get started.</p>
          <Button className="mt-4" size="sm" onClick={openMemberDrawer}>+ Add member</Button>
        </Card>
      ) : (
        <DataTable<Member> columns={columns} rows={visibleMembers} rowKey={(r) => r.id} />
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          CREATE TEAM DRAWER
      ══════════════════════════════════════════════════════════════════════════ */}
      {teamDrawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTeamDrawerOpen(false)} />
          <div className="relative ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Create a new team</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Configure every detail before going live.</p>
              </div>
              <button onClick={() => setTeamDrawerOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={createTeam} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-7 px-6 py-6">

                {/* ── Basics ───────────────────────────────────────────────── */}
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Basics</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Team name <span className="text-red-500">*</span></Label>
                      <Input required value={form.name} onChange={set("name")} placeholder="e.g. Tier 1 Customer Support" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input value={form.description} onChange={set("description")} placeholder="What does this team handle?" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Timezone</Label>
                        <Select value={form.timezone} onChange={set("timezone")}>
                          <option value="Africa/Nairobi">Africa/Nairobi (EAT +3)</option>
                          <option value="Africa/Lagos">Africa/Lagos (WAT +1)</option>
                          <option value="Africa/Johannesburg">Africa/Johannesburg (SAST +2)</option>
                          <option value="Africa/Cairo">Africa/Cairo (EET +2)</option>
                          <option value="Europe/London">Europe/London (GMT/BST)</option>
                          <option value="Europe/Paris">Europe/Paris (CET +1)</option>
                          <option value="America/New_York">America/New York (EST)</option>
                          <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                          <option value="Asia/Dubai">Asia/Dubai (GST +4)</option>
                          <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                          <option value="Asia/Manila">Asia/Manila (PHT +8)</option>
                          <option value="UTC">UTC</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Currency</Label>
                        <Select value={form.currency} onChange={set("currency")}>
                          <option value="KES">KES — Kenyan Shilling</option>
                          <option value="USD">USD — US Dollar</option>
                          <option value="GBP">GBP — British Pound</option>
                          <option value="EUR">EUR — Euro</option>
                          <option value="NGN">NGN — Nigerian Naira</option>
                          <option value="ZAR">ZAR — South African Rand</option>
                          <option value="UGX">UGX — Ugandan Shilling</option>
                          <option value="TZS">TZS — Tanzanian Shilling</option>
                          <option value="GHS">GHS — Ghanaian Cedi</option>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Task categories <span className="text-zinc-400 font-normal text-[11px]">comma-separated</span></Label>
                      <Input value={form.categories} onChange={set("categories")} placeholder="e.g. Support, KYC verification, Back-office, Voice calls" />
                      <p className="mt-1 text-[11px] text-zinc-400">Used when assigning jobs and filtering task queues for this team.</p>
                    </div>
                  </div>
                </section>

                {/* ── SLA Defaults ─────────────────────────────────────────── */}
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">SLA Defaults</h3>
                  <p className="mb-3 text-[11px] text-zinc-400">How many minutes before a task at each priority level breaches SLA.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Low priority <span className="text-zinc-400 font-normal">(min)</span></Label>
                      <Input type="number" min={5} value={form.slaLow} onChange={set("slaLow")} />
                      <p className="mt-1 text-[10px] text-zinc-400">Default {form.slaLow}m = {Math.floor(Number(form.slaLow) / 60)}h {Number(form.slaLow) % 60}m</p>
                    </div>
                    <div>
                      <Label>Medium priority <span className="text-zinc-400 font-normal">(min)</span></Label>
                      <Input type="number" min={5} value={form.slaMedium} onChange={set("slaMedium")} />
                      <p className="mt-1 text-[10px] text-zinc-400">Default {form.slaMedium}m = {Math.floor(Number(form.slaMedium) / 60)}h {Number(form.slaMedium) % 60}m</p>
                    </div>
                    <div>
                      <Label>High priority <span className="text-zinc-400 font-normal">(min)</span></Label>
                      <Input type="number" min={1} value={form.slaHigh} onChange={set("slaHigh")} />
                      <p className="mt-1 text-[10px] text-zinc-400">Default {form.slaHigh}m = {Number(form.slaHigh)} minutes</p>
                    </div>
                    <div>
                      <Label>Urgent <span className="text-zinc-400 font-normal">(min)</span></Label>
                      <Input type="number" min={1} value={form.slaUrgent} onChange={set("slaUrgent")} />
                      <p className="mt-1 text-[10px] text-zinc-400">Default {form.slaUrgent}m — escalates fast</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label>Auto-escalate after <span className="text-zinc-400 font-normal">(min of SLA breach)</span></Label>
                    <Input type="number" min={1} value={form.escalationAfter} onChange={set("escalationAfter")} />
                    <p className="mt-1 text-[11px] text-zinc-400">Tasks escalate to supervisor automatically {form.escalationAfter} minutes after SLA breach.</p>
                  </div>
                </section>

                {/* ── Working hours ─────────────────────────────────────────── */}
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400">Working Hours</h3>
                  <p className="mb-3 text-[11px] text-zinc-400">Core shift hours for this team. Used for SLA calculations and shift scheduling.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Shift start</Label>
                      <Input type="time" value={form.shiftStart} onChange={set("shiftStart")} />
                    </div>
                    <div>
                      <Label>Shift end</Label>
                      <Input type="time" value={form.shiftEnd} onChange={set("shiftEnd")} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label>Working days</Label>
                    <div className="mt-2 flex gap-1.5">
                      {WEEKDAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(d)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition
                            ${form.workDays.includes(d)
                              ? "bg-brand-600 text-white"
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                            }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── Operational rules ─────────────────────────────────────── */}
                <section>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Operational Rules</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Max concurrent tasks per agent</Label>
                      <Input type="number" min={1} max={50} value={form.maxTasksPerAgent} onChange={set("maxTasksPerAgent")} />
                      <p className="mt-1 text-[11px] text-zinc-400">Agents in this team won&apos;t be auto-assigned beyond this limit.</p>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Auto-assign tasks</p>
                        <p className="text-[11px] text-zinc-400">Automatically assign incoming tasks to available agents</p>
                      </div>
                      <button
                        type="button"
                        onClick={toggle("autoAssign")}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                          ${form.autoAssign ? "bg-brand-600" : "bg-zinc-200 dark:bg-zinc-700"}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
                          ${form.autoAssign ? "translate-x-4.5" : "translate-x-0.5"}`}
                          style={{ transform: form.autoAssign ? "translateX(18px)" : "translateX(2px)" }}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Require task completion notes</p>
                        <p className="text-[11px] text-zinc-400">Agents must add a note when marking a task complete</p>
                      </div>
                      <button
                        type="button"
                        onClick={toggle("requireTaskNotes")}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
                          ${form.requireTaskNotes ? "bg-brand-600" : "bg-zinc-200 dark:bg-zinc-700"}`}
                      >
                        <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
                          style={{ transform: form.requireTaskNotes ? "translateX(18px)" : "translateX(2px)" }}
                        />
                      </button>
                    </div>
                  </div>
                </section>

                {teamErr && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">{teamErr}</div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setTeamDrawerOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={creatingTeam}>
                  {creatingTeam ? "Creating…" : "Create team"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          ADD MEMBER DRAWER
      ══════════════════════════════════════════════════════════════════════════ */}
      {memberDrawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMemberDrawerOpen(false)} />
          <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add team member</h2>
                <p className="text-xs text-zinc-400">
                  Creates their account and emails login credentials
                  {selectedTeamId && teams.find(t => t.id === selectedTeamId) ? ` for ${teams.find(t => t.id === selectedTeamId)!.name}` : ""}.
                </p>
              </div>
              <button onClick={() => setMemberDrawerOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddMember} className="flex flex-1 flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-5 px-6 py-6">

                {/* Email first — it's the core of an invite */}
                <div>
                  <Label>Work email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                  />
                  <p className="mt-1 text-[11px] text-zinc-400">Login credentials will be sent to this address.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" /></div>
                  <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" /></div>
                </div>

                <div>
                  <Label>Phone number</Label>
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" />
                  <p className="mt-1 text-[11px] text-zinc-400">We&apos;ll also SMS their credentials if provided.</p>
                </div>

                <div>
                  <Label>Team <span className="text-red-500">*</span></Label>
                  {teams.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-600">No teams yet — create a team first before adding members.</p>
                  ) : (
                    <>
                      <Select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
                        <option value="">— Select a team —</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </Select>
                      <p className="mt-1 text-[11px] text-zinc-400">Their invite email will reference this team by name.</p>
                    </>
                  )}
                </div>

                <div>
                  <Label>Role</Label>
                  <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                    {ROLES.filter((r) => r !== "OWNER").map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {role === "ADMIN" && "Full access — team, billing, agents."}
                    {role === "SUPERVISOR" && "Can create jobs and manage agents."}
                    {role === "MEMBER" && "Can create jobs only."}
                    {role === "BILLING" && "Billing and reports only."}
                    {role === "VIEWER" && "Read-only access."}
                  </p>
                </div>

                <div>
                  <Label>Personal message <span className="text-zinc-400 font-normal">(optional)</span></Label>
                  <Input value={personalMessage} onChange={(e) => setPersonalMessage(e.target.value)} placeholder="Looking forward to working with you!" />
                </div>

                {memberErr && (
                  <div className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">{memberErr}</div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setMemberDrawerOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={savingMember || teams.length === 0}>
                  {savingMember ? "Creating…" : "Create member"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
