"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorState, Input, Label, LoadingState, PageHeader, Select, Textarea } from "@/components/ui";
import { apiGet, apiPost, apiPatch, apiDelete, extractItems } from "@/lib/api";
import type { ApiKey, Webhook } from "@/lib/types";
import { fmtRelative } from "@/lib/format";

interface WorkspaceSettings {
  name?: string;
  timezone?: string;
  defaultSlaMinutes?: number;
  escalationRules?: string;
}

const INTEGRATIONS = [
  { id: "crm", name: "CRM", description: "Sync tasks and contacts with your CRM (Salesforce, HubSpot).", connected: false },
  { id: "slack", name: "Slack", description: "Get alerts and updates posted to a Slack channel.", connected: true },
  { id: "zapier", name: "Zapier", description: "Trigger automations with Zapier webhooks.", connected: false },
];

const NOTIF_PREFS = [
  { key: "sla_breach", label: "SLA breach alerts", default: true },
  { key: "job_complete", label: "Job completion", default: true },
  { key: "new_message", label: "New chat messages", default: false },
  { key: "agent_offline", label: "Agent goes offline", default: true },
  { key: "escalation", label: "Escalation raised", default: true },
  { key: "billing", label: "Billing & payments", default: true },
];

export default function SettingsPage() {
  const [wsName, setWsName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [defaultSla, setDefaultSla] = useState(60);
  const [escalationRules, setEscalationRules] = useState("At 75% of SLA — notify supervisor.\nAt 100% — reassign to next available agent.");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_PREFS.map((p) => [p.key, p.default])),
  );

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState("task.completed,task.failed");

  const [tab, setTab] = useState<"general" | "notifications" | "api" | "webhooks" | "integrations">("general");

  useEffect(() => {
    (async () => {
      try {
        const [settings, keys, whs] = await Promise.all([
          apiGet<WorkspaceSettings>("/workspaces/settings").catch(() => null),
          apiGet<ApiKey[]>("/api-keys").catch(() => [] as ApiKey[]),
          apiGet<Webhook[]>("/webhooks").catch(() => [] as Webhook[]),
        ]);
        if (settings) {
          setWsName(settings.name ?? "");
          setTimezone(settings.timezone ?? "UTC");
          setDefaultSla(settings.defaultSlaMinutes ?? 60);
          setEscalationRules(settings.escalationRules ?? escalationRules);
        }
        setApiKeys(extractItems<ApiKey>(keys));
        setWebhooks(extractItems<Webhook>(whs));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    try { await apiPatch("/workspaces/settings", { name: wsName, timezone, defaultSlaMinutes: defaultSla, escalationRules }); } catch { /* stub */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const createApiKey = async () => {
    if (!newKeyLabel.trim()) return;
    try {
      const key = await apiGet<ApiKey>(`/api-keys/create?label=${encodeURIComponent(newKeyLabel)}`);
      setApiKeys((prev) => [key, ...prev]);
    } catch {
      const key: ApiKey = { id: `ak-${Date.now()}`, label: newKeyLabel, prefix: `wsp_${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString() };
      setApiKeys((prev) => [key, ...prev]);
    }
    setNewKeyLabel("");
  };

  const revokeApiKey = (id: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    try { apiDelete(`/api-keys/${id}`).catch(() => {}); } catch { /* stub */ }
  };

  const createWebhook = async () => {
    if (!whUrl.trim()) return;
    try {
      const wh = await apiPost<Webhook>("/webhooks", { url: whUrl, events: whEvents.split(",").map((e) => e.trim()), active: true });
      setWebhooks((prev) => [wh, ...prev]);
    } catch {
      const wh: Webhook = { id: `wh-${Date.now()}`, url: whUrl, events: whEvents.split(",").map((e) => e.trim()), active: true, createdAt: new Date().toISOString() };
      setWebhooks((prev) => [wh, ...prev]);
    }
    setWhUrl("");
  };

  const removeWebhook = async (id: string) => {
    try { await apiDelete(`/webhooks/${id}`); } catch { /* stub */ }
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const tabs = [
    { key: "general" as const, label: "General" },
    { key: "notifications" as const, label: "Notifications" },
    { key: "api" as const, label: "API keys" },
    { key: "webhooks" as const, label: "Webhooks" },
    { key: "integrations" as const, label: "Integrations" },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Workspace configuration, API keys, integrations." />

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${tab === t.key ? "border-brand-600 text-brand-700 dark:text-brand-200" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <Card>
          <form onSubmit={save} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Workspace name</Label>
                <Input value={wsName} onChange={(e) => setWsName(e.target.value)} />
              </div>
              <div>
                <Label>Timezone</Label>
                <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  <option value="UTC">UTC</option>
                  <option value="Africa/Nairobi">Africa/Nairobi</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </Select>
              </div>
              <div>
                <Label>Default task SLA (minutes)</Label>
                <Input type="number" min={5} value={defaultSla} onChange={(e) => setDefaultSla(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Escalation rules</Label>
              <Textarea value={escalationRules} onChange={(e) => setEscalationRules(e.target.value)} rows={5} />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit">Save changes</Button>
              {saved && <span className="text-xs text-emerald-600">Saved</span>}
            </div>
          </form>
        </Card>
      )}

      {tab === "notifications" && (
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Notification preferences</h3>
          <div className="space-y-3">
            {NOTIF_PREFS.map((p) => (
              <label key={p.key} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={notifPrefs[p.key] ?? false}
                  onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                  className="rounded"
                />
                {p.label}
              </label>
            ))}
          </div>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => save(new Event("submit") as unknown as FormEvent)}>Save preferences</Button>
        </Card>
      )}

      {tab === "api" && (
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">API keys</h3>
          <div className="mb-4 flex gap-2">
            <Input placeholder="Key label" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} className="max-w-xs" />
            <Button size="sm" onClick={createApiKey}>Generate</Button>
          </div>
          {apiKeys.length === 0 ? (
            <p className="text-sm text-zinc-400">No API keys yet. Generate one above.</p>
          ) : (
            <ul className="space-y-2">
              {apiKeys.map((k) => (
                <li key={k.id} className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{k.label}</span>
                    <span className="ml-2 text-xs text-zinc-400">{k.prefix}...</span>
                    {k.lastUsedAt && <span className="ml-2 text-[10px] text-zinc-400">Last used {fmtRelative(k.lastUsedAt)}</span>}
                  </div>
                  <button onClick={() => revokeApiKey(k.id)} className="text-[11px] text-red-600 hover:underline">Revoke</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "webhooks" && (
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Webhooks</h3>
          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input placeholder="Endpoint URL" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} />
            <Input placeholder="Events (comma-separated)" value={whEvents} onChange={(e) => setWhEvents(e.target.value)} />
            <Button size="sm" onClick={createWebhook}>Add</Button>
          </div>
          {webhooks.length === 0 ? (
            <p className="text-sm text-zinc-400">No webhooks configured yet.</p>
          ) : (
            <ul className="space-y-2">
              {webhooks.map((wh) => (
                <li key={wh.id} className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{wh.url}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {wh.events.map((e) => (
                        <span key={e} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">{e}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={wh.active ? "success" : "default"}>{wh.active ? "Active" : "Inactive"}</Badge>
                    <button onClick={() => removeWebhook(wh.id)} className="text-[11px] text-red-600 hover:underline">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "integrations" && (
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Integrations</h3>
          <div className="space-y-3">
            {INTEGRATIONS.map((intg) => (
              <div key={intg.id} className="flex items-center justify-between rounded-md border border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{intg.name}</p>
                  <p className="text-xs text-zinc-500">{intg.description}</p>
                </div>
                <Button size="sm" variant={intg.connected ? "outline" : "primary"}>
                  {intg.connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
