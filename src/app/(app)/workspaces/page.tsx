"use client";

import { useEffect, useState, FormEvent } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { WORKSPACE_KEY, apiGet, apiPost, apiPatch } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { fmtDate } from "@/lib/format";

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState("");
  const [slaLow, setSlaLow] = useState(480);
  const [slaHigh, setSlaHigh] = useState(60);
  const [currency, setCurrency] = useState("USD");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategories, setEditCategories] = useState("");
  const [editSlaLow, setEditSlaLow] = useState(480);
  const [editSlaHigh, setEditSlaHigh] = useState(60);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiGet<Workspace[]>("/workspaces");
      setWorkspaces(Array.isArray(data) ? data : []);
      const saved = typeof window !== "undefined" ? localStorage.getItem(WORKSPACE_KEY) : null;
      if (saved) setActive(saved);
      else if (Array.isArray(data) && data.length > 0) setActive(data[0].id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function choose(id: string) {
    setActive(id);
    if (typeof window !== "undefined") localStorage.setItem(WORKSPACE_KEY, id);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const cats = categories.split(",").map((c) => c.trim()).filter(Boolean);
    try {
      await apiPost("/workspaces", {
        name,
        timezone,
        description,
        categories: cats,
        slaDefaults: { low: slaLow, medium: Math.round((slaLow + slaHigh) / 2), high: slaHigh, urgent: 15 },
        currency,
      });
    } catch { /* stub */ }
    const w: Workspace = {
      id: `ws-${Date.now()}`,
      businessId: "",
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      timezone,
      description,
      categories: cats,
      slaDefaults: { low: slaLow, medium: Math.round((slaLow + slaHigh) / 2), high: slaHigh, urgent: 15 },
      currency,
      memberCount: 1,
      createdAt: new Date().toISOString(),
    };
    setWorkspaces((prev) => [w, ...prev]);
    setName("");
    setDescription("");
    setCategories("");
  }

  const archive = (id: string) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, archived: true } : w)));
  };

  const openEdit = (w: Workspace) => {
    setEditId(w.id);
    setEditName(w.name);
    setEditCategories((w.categories ?? []).join(", "));
    setEditSlaLow(w.slaDefaults?.low ?? 480);
    setEditSlaHigh(w.slaDefaults?.high ?? 60);
  };

  const saveEdit = async () => {
    if (!editId) return;
    try { await apiPatch(`/workspaces/${editId}`, { name: editName }); } catch { /* stub */ }
    setWorkspaces((prev) =>
      prev.map((w) =>
        w.id === editId
          ? {
              ...w,
              name: editName,
              categories: editCategories.split(",").map((c) => c.trim()).filter(Boolean),
              slaDefaults: { low: editSlaLow, medium: Math.round((editSlaLow + editSlaHigh) / 2), high: editSlaHigh, urgent: 15 },
            }
          : w,
      ),
    );
    setEditId(null);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Workspaces" subtitle="Create, switch, or configure workspaces." />

      {editId && (
        <Card className="mb-6 border-brand-200 dark:border-brand-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Edit workspace</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Task categories (comma-separated)</Label>
              <Input value={editCategories} onChange={(e) => setEditCategories(e.target.value)} placeholder="Support, KYC, Voice" />
            </div>
            <div>
              <Label>Default SLA — Low priority (min)</Label>
              <Input type="number" value={editSlaLow} onChange={(e) => setEditSlaLow(Number(e.target.value))} />
            </div>
            <div>
              <Label>Default SLA — High priority (min)</Label>
              <Input type="number" value={editSlaHigh} onChange={(e) => setEditSlaHigh(Number(e.target.value))} />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={saveEdit}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Create a new workspace</h3>
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Workspace name *</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales operations" />
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="UTC">UTC</option>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Manila">Asia/Manila (PHT)</option>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD — US Dollar</option>
                <option value="KES">KES — Kenyan Shilling</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="NGN">NGN — Nigerian Naira</option>
                <option value="ZAR">ZAR — South African Rand</option>
              </Select>
            </div>
            <div>
              <Label>Task categories <span className="text-zinc-400">(comma-separated)</span></Label>
              <Input value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Support, KYC, Voice, Back-office" />
            </div>
            <div>
              <Label>Default SLA — Low priority (minutes)</Label>
              <Input type="number" min={5} value={slaLow} onChange={(e) => setSlaLow(Number(e.target.value))} />
            </div>
            <div>
              <Label>Default SLA — High priority (minutes)</Label>
              <Input type="number" min={5} value={slaHigh} onChange={(e) => setSlaHigh(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Description <span className="text-zinc-400">(optional)</span></Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of what this workspace handles" />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Create workspace</Button>
          </div>
        </form>
      </Card>

      {workspaces.filter((w) => !w.archived).length === 0 ? (
        <EmptyState title="No workspaces yet" message="Create your first workspace above." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.filter((w) => !w.archived).map((w) => (
            <Card key={w.id} className="flex flex-col justify-between">
              <div>
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{w.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {w.memberCount} members · Created {fmtDate(w.createdAt, { dateStyle: "medium" })}
                </p>
                {w.categories && w.categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {w.categories.map((c) => (
                      <span key={c} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{c}</span>
                    ))}
                  </div>
                )}
                {w.slaDefaults && (
                  <p className="mt-1 text-[10px] text-zinc-400">
                    SLA defaults: Low {w.slaDefaults.low}m · High {w.slaDefaults.high}m
                  </p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant={active === w.id ? "secondary" : "outline"} size="sm" onClick={() => choose(w.id)}>
                  {active === w.id ? "Current" : "Switch"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => archive(w.id)}>Archive</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {workspaces.some((w) => w.archived) && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-zinc-500">Archived workspaces</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {workspaces.filter((w) => w.archived).map((w) => (
              <Card key={w.id} className="opacity-60">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{w.name}</p>
                <Badge tone="default">Archived</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
