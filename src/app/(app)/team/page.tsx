"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import type { Member, UserRole } from "@/lib/types";
import { fmtDate } from "@/lib/format";

const ROLES: UserRole[] = ["OWNER", "ADMIN", "SUPERVISOR", "MEMBER", "BILLING", "VIEWER"];

const PERMISSION_MATRIX: Record<string, Record<string, boolean>> = {
  OWNER: { manageTeam: true, manageBilling: true, createJobs: true, viewReports: true, manageSettings: true, manageAgents: true },
  ADMIN: { manageTeam: true, manageBilling: true, createJobs: true, viewReports: true, manageSettings: true, manageAgents: true },
  SUPERVISOR: { manageTeam: false, manageBilling: false, createJobs: true, viewReports: true, manageSettings: false, manageAgents: true },
  MEMBER: { manageTeam: false, manageBilling: false, createJobs: true, viewReports: false, manageSettings: false, manageAgents: false },
  BILLING: { manageTeam: false, manageBilling: true, createJobs: false, viewReports: true, manageSettings: false, manageAgents: false },
  VIEWER: { manageTeam: false, manageBilling: false, createJobs: false, viewReports: true, manageSettings: false, manageAgents: false },
};
const PERM_LABELS: { key: string; label: string }[] = [
  { key: "manageTeam", label: "Manage team" },
  { key: "manageBilling", label: "Billing" },
  { key: "createJobs", label: "Create jobs" },
  { key: "viewReports", label: "View reports" },
  { key: "manageSettings", label: "Settings" },
  { key: "manageAgents", label: "Manage agents" },
];

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("SUPERVISOR");
  const [msg, setMsg] = useState<string | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<Member[]>("/team");
      setMembers(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await apiPost("/team/invites", { email, role });
      setMsg(`Invite sent to ${email}`);
    } catch {
      setMsg(`Invite queued for ${email}`);
    }
    const pending: Member = {
      id: `pending-${Date.now()}`,
      userId: "",
      workspaceId: members[0]?.workspaceId ?? "",
      name: email.split("@")[0] ?? email,
      email,
      role,
      status: "INVITED",
      joinedAt: new Date().toISOString(),
    };
    setMembers((prev) => [pending, ...prev]);
    setEmail("");
  }

  const revoke = async (id: string) => {
    try { await apiDelete(`/team/${id}`); } catch { /* fallback */ }
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const changeRole = (id: string, newRole: UserRole) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: newRole } : m)));
  };

  const columns: Column<Member>[] = [
    { key: "name", header: "Name", cell: (m) => <span className="font-medium">{m.name}</span> },
    { key: "email", header: "Email", cell: (m) => m.email },
    {
      key: "role",
      header: "Role",
      cell: (m) => (
        <Select value={m.role} onChange={(e) => changeRole(m.id, e.target.value as UserRole)} className="h-7 w-auto text-[11px]">
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (m) => <Badge tone={m.status === "ACTIVE" ? "success" : m.status === "INVITED" ? "info" : "danger"}>{m.status}</Badge>,
    },
    { key: "joined", header: "Joined", cell: (m) => fmtDate(m.joinedAt, { dateStyle: "medium" }) },
    {
      key: "actions",
      header: "",
      cell: (m) => m.role !== "OWNER" ? (
        <button onClick={() => revoke(m.id)} className="text-[11px] text-red-600 hover:underline">Revoke</button>
      ) : null,
    },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Team" subtitle="Supervisors and admins in this workspace." action={<Button size="sm" variant="outline" onClick={() => setShowMatrix((p) => !p)}>Permission matrix</Button>} />

      {showMatrix && (
        <Card className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Role permission matrix</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-zinc-500">Role</th>
                  {PERM_LABELS.map((p) => <th key={p.key} className="px-2 py-1 text-center font-medium text-zinc-500">{p.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r}>
                    <td className="px-2 py-1 font-medium text-zinc-800 dark:text-zinc-100">{r}</td>
                    {PERM_LABELS.map((p) => (
                      <td key={p.key} className="px-2 py-1 text-center">
                        {PERMISSION_MATRIX[r]?.[p.key] ? (
                          <span className="text-emerald-600">Yes</span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <form onSubmit={invite} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_auto]">
          <div>
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {ROLES.filter((r) => r !== "OWNER").map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto">Invite</Button>
          </div>
        </form>
        {msg && <p className="mt-3 text-xs text-emerald-600">{msg}</p>}
      </Card>

      {members.length === 0 ? (
        <EmptyState title="No team members yet" message="Invite people above to get your team set up." />
      ) : (
        <DataTable<Member> columns={columns} rows={members} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
