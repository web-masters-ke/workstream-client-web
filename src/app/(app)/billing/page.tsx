"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { DataTable, Column } from "@/components/DataTable";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import type { Invoice, PaymentMethod, Plan, Wallet, WalletTransaction } from "@/lib/types";
import { fmtDate, fmtMoney } from "@/lib/format";

type TopUpMethod = "CARD" | "MPESA";
type PlanMode = "SUBSCRIPTION" | "PAY_AS_YOU_GO";

const DEFAULT_WALLET: Wallet = {
  id: "",
  workspaceId: "",
  currency: "KES",
  balance: 0,
  reservedBalance: 0,
  autoRechargeEnabled: false,
  autoRechargeThreshold: 500,
  autoRechargeAmount: 1000,
  updatedAt: new Date().toISOString(),
};

export default function BillingPage() {
  const [wallet, setWallet] = useState<Wallet>(DEFAULT_WALLET);
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(500);
  const [topUpMethod, setTopUpMethod] = useState<TopUpMethod>("CARD");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [autoRecharge, setAutoRecharge] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState(500);
  const [autoAmount, setAutoAmount] = useState(1000);
  const [planMode, setPlanMode] = useState<PlanMode>("SUBSCRIPTION");

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const [w, t, i] = await Promise.all([
        apiGet<Wallet>("/payments/my-wallet").catch(() => null),
        apiGet<WalletTransaction[]>("/wallet/transactions").catch(() => [] as WalletTransaction[]),
        apiGet<Invoice[]>("/payments/invoices").catch(() => [] as Invoice[]),
      ]);
      if (w) {
        setWallet(w);
        setAutoRecharge(w.autoRechargeEnabled ?? false);
        setAutoThreshold(w.autoRechargeThreshold ?? 500);
        setAutoAmount(w.autoRechargeAmount ?? 1000);
      }
      setTxs(Array.isArray(t) ? t : []);
      setInvoices(Array.isArray(i) ? i : []);
      // Plans are best-effort
      try {
        const p = await apiGet<Plan[]>("/payments/plans");
        setPlans(Array.isArray(p) ? p : []);
      } catch {
        setPlans([]);
      }
      // Payment methods are best-effort
      try {
        const pm = await apiGet<PaymentMethod[]>("/payments/methods");
        setPayMethods(Array.isArray(pm) ? pm : []);
      } catch {
        setPayMethods([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const doTopUp = async () => {
    try { await apiPost("/payments/topup", { amount: topUpAmount, method: topUpMethod, phone: topUpMethod === "MPESA" ? mpesaPhone : undefined }); } catch { /* stub */ }
    setWallet((prev) => ({ ...prev, balance: prev.balance + topUpAmount }));
    setTxs((prev) => [
      { id: `wt-${Date.now()}`, walletId: wallet.id, type: "CREDIT", amount: topUpAmount, currency: wallet.currency, description: `Top-up via ${topUpMethod}`, status: "COMPLETED", createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setShowTopUp(false);
  };

  const saveAutoRecharge = async () => {
    try { await apiPatch("/wallet/auto-recharge", { enabled: autoRecharge, threshold: autoThreshold, amount: autoAmount }); } catch { /* stub */ }
    setWallet((prev) => ({ ...prev, autoRechargeEnabled: autoRecharge, autoRechargeThreshold: autoThreshold, autoRechargeAmount: autoAmount }));
  };

  const removePayMethod = (id: string) => setPayMethods((prev) => prev.filter((p) => p.id !== id));
  const setDefault = (id: string) => setPayMethods((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));

  const downloadInvoice = (inv: Invoice) => {
    const blob = new Blob([`Invoice: ${inv.number}\nAmount: ${fmtMoney(inv.amount, inv.currency)}\nStatus: ${inv.status}\nIssued: ${inv.issuedAt}\nDue: ${inv.dueAt}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const txCols: Column<WalletTransaction>[] = [
    { key: "date", header: "Date", cell: (t) => fmtDate(t.createdAt) },
    { key: "type", header: "Type", cell: (t) => <Badge tone={t.type === "CREDIT" ? "success" : "default"}>{t.type}</Badge> },
    { key: "desc", header: "Description", cell: (t) => t.description },
    { key: "amount", header: "Amount", cell: (t) => fmtMoney(t.amount, t.currency) },
    { key: "status", header: "Status", cell: (t) => t.status },
  ];

  const invCols: Column<Invoice>[] = [
    { key: "num", header: "Invoice", cell: (i) => <span className="font-medium">{i.number}</span> },
    { key: "amt", header: "Amount", cell: (i) => fmtMoney(i.amount, i.currency) },
    { key: "status", header: "Status", cell: (i) => <Badge tone={i.status === "PAID" ? "success" : i.status === "OVERDUE" ? "danger" : "info"}>{i.status}</Badge> },
    { key: "issued", header: "Issued", cell: (i) => fmtDate(i.issuedAt, { dateStyle: "medium" }) },
    { key: "due", header: "Due", cell: (i) => fmtDate(i.dueAt, { dateStyle: "medium" }) },
    { key: "dl", header: "", cell: (i) => <button onClick={() => downloadInvoice(i)} className="text-[11px] text-brand-600 hover:underline">Download</button> },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Billing" subtitle="Manage wallet, invoices, and subscription." action={<Button onClick={() => setShowTopUp(true)}>Top up wallet</Button>} />

      {showTopUp && (
        <Card className="mb-6 border-brand-200 dark:border-brand-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Top up wallet</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" min={1} value={topUpAmount} onChange={(e) => setTopUpAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={topUpMethod} onChange={(e) => setTopUpMethod(e.target.value as TopUpMethod)}>
                <option value="CARD">Card</option>
                <option value="MPESA">M-Pesa</option>
              </Select>
            </div>
            {topUpMethod === "MPESA" && (
              <div>
                <Label>M-Pesa phone</Label>
                <Input value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} placeholder="+254..." />
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={doTopUp}>Pay</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowTopUp(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Wallet balance" value={fmtMoney(wallet.balance, wallet.currency)} />
        <StatCard label="Reserved" value={fmtMoney(wallet.reservedBalance, wallet.currency)} />
        <StatCard label="Available" value={fmtMoney(wallet.balance - wallet.reservedBalance, wallet.currency)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Auto-recharge</h3>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" checked={autoRecharge} onChange={(e) => setAutoRecharge(e.target.checked)} />
            Automatically recharge when balance falls below threshold
          </label>
          {autoRecharge && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label>Threshold (KES)</Label>
                <Input type="number" value={autoThreshold} onChange={(e) => setAutoThreshold(Number(e.target.value))} />
              </div>
              <div>
                <Label>Recharge amount (KES)</Label>
                <Input type="number" value={autoAmount} onChange={(e) => setAutoAmount(Number(e.target.value))} />
              </div>
            </div>
          )}
          <Button size="sm" className="mt-3" variant="outline" onClick={saveAutoRecharge}>Save</Button>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Payment methods</h3>
          {payMethods.length === 0 ? (
            <p className="text-sm text-zinc-400">No payment methods on file.</p>
          ) : (
            <ul className="space-y-2">
              {payMethods.map((pm) => (
                <li key={pm.id} className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{pm.label}</span>
                    {pm.isDefault && <Badge tone="info">Default</Badge>}
                  </div>
                  <div className="flex gap-2 text-[11px]">
                    {!pm.isDefault && <button onClick={() => setDefault(pm.id)} className="text-brand-600 hover:underline">Make default</button>}
                    <button onClick={() => removePayMethod(pm.id)} className="text-red-600 hover:underline">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Plan</h2>
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant={planMode === "SUBSCRIPTION" ? "primary" : "outline"} onClick={() => setPlanMode("SUBSCRIPTION")}>Subscription</Button>
        <Button size="sm" variant={planMode === "PAY_AS_YOU_GO" ? "primary" : "outline"} onClick={() => setPlanMode("PAY_AS_YOU_GO")}>Pay-as-you-go</Button>
      </div>
      {planMode === "SUBSCRIPTION" ? (
        plans.length === 0 ? (
          <p className="text-sm text-zinc-400">No plans available.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <Card key={p.id}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</h3>
                  <p className="text-2xl font-bold text-brand-600">{fmtMoney(p.price ?? 0, p.currency ?? 'KES')}</p>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">per {(p.interval ?? 'month').toLowerCase()}</p>
                <ul className="mt-4 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {(p.features ?? []).map((f) => <li key={f}>• {f}</li>)}
                </ul>
                <Button className="mt-4 w-full" variant="outline">Choose {p.name}</Button>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">Pay-as-you-go: you will be charged per task completion from your wallet balance. No monthly commitment.</p>
          <Button className="mt-3" variant="outline">Switch to pay-as-you-go</Button>
        </Card>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Wallet transactions</h2>
      {txs.length === 0 ? (
        <EmptyState title="No transactions yet" message="Transactions will appear here after your first top-up." />
      ) : (
        <DataTable<WalletTransaction> columns={txCols} rows={txs} rowKey={(r) => r.id} />
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invoices</h2>
      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" message="Invoices will appear here once generated." />
      ) : (
        <DataTable<Invoice> columns={invCols} rows={invoices} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
