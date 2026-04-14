"use client";

import { FormEvent, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { DataTable, Column } from "@/components/DataTable";
import { apiPost } from "@/lib/api";
import type { SupportTicket } from "@/lib/types";
import { fmtRelative } from "@/lib/format";

const FAQ = [
  { q: "How do I create a job?", a: "Go to Jobs > New job, or use the quick-create button on the overview page." },
  { q: "How is billing calculated?", a: "You set a rate per job (per task, per minute, or per outcome). Charges are deducted from your wallet as tasks are completed." },
  { q: "What happens when SLA is breached?", a: "The system triggers an escalation and notifies supervisors. You can configure escalation rules in Settings." },
  { q: "How do I invite agents?", a: "Go to Agents > Invite agent. You can invite by email or phone." },
  { q: "Can I export data?", a: "Yes, most list pages (Jobs, Tasks, Reports) have an Export CSV button." },
];

export default function HelpPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [description, setDescription] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    try {
      await apiPost("/support/tickets", { subject, priority, description });
    } catch { /* stub */ }
    const tk: SupportTicket = {
      id: `tk-${Date.now()}`,
      subject,
      status: "OPEN",
      priority,
      createdAt: new Date().toISOString(),
    };
    setTickets((prev) => [tk, ...prev]);
    setShowNew(false);
    setSubject("");
    setDescription("");
  };

  const cols: Column<SupportTicket>[] = [
    { key: "subject", header: "Subject", cell: (t) => <span className="font-medium text-zinc-800 dark:text-zinc-100">{t.subject}</span> },
    {
      key: "status",
      header: "Status",
      cell: (t) => <Badge tone={t.status === "RESOLVED" ? "success" : t.status === "IN_REVIEW" ? "warning" : "info"}>{t.status}</Badge>,
    },
    {
      key: "priority",
      header: "Priority",
      cell: (t) => <Badge tone={t.priority === "HIGH" ? "danger" : t.priority === "MEDIUM" ? "warning" : "default"}>{t.priority}</Badge>,
    },
    { key: "date", header: "Created", cell: (t) => fmtRelative(t.createdAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Help & support"
        subtitle="FAQs and support tickets."
        action={<Button size="sm" onClick={() => setShowNew(true)}>Raise a ticket</Button>}
      />

      <Card className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Frequently asked questions</h3>
        <div className="space-y-1">
          {FAQ.map((f, i) => (
            <div key={i} className="rounded-md border border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-zinc-800 dark:text-zinc-100"
              >
                {f.q}
                <span className="text-xs text-zinc-400">{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && (
                <p className="px-3 pb-2 text-xs text-zinc-600 dark:text-zinc-400">{f.a}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {showNew && (
        <Card className="mb-6 border-brand-200 dark:border-brand-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">New support ticket</h3>
          <form onSubmit={submit} className="mt-3 space-y-3">
            <div>
              <Label>Subject</Label>
              <Input required value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">Submit</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Your tickets</h3>
      {tickets.length === 0 ? (
        <EmptyState title="No tickets yet" message="Submit a ticket above if you need help." />
      ) : (
        <DataTable<SupportTicket> columns={cols} rows={tickets} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
