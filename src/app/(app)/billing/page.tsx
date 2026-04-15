"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Select,
} from "@/components/ui";
import { StatCard } from "@/components/StatCard";
import { DataTable, Column } from "@/components/DataTable";
import { apiGet, apiPatch, apiPost, extractItems } from "@/lib/api";
import type { Invoice, PaymentMethod, Plan, Wallet, WalletTransaction } from "@/lib/types";
import { fmtDate, fmtMoney } from "@/lib/format";

// ── types ──────────────────────────────────────────────────────────────────
type TopUpMethod = "MPESA" | "CARD";
type TxFilter = "ALL" | "TOPUP" | "DEBIT" | "PAYOUT";
type TopUpStep = "FORM" | "AWAITING" | "SUCCESS";

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

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

// ── helpers ────────────────────────────────────────────────────────────────
function txTypeTone(type: string): "success" | "danger" | "info" | "default" {
  if (type === "TOPUP" || type === "CREDIT" || type === "REFUND") return "success";
  if (type === "DEBIT" || type === "FEE" || type === "WITHDRAWAL") return "danger";
  if (type === "PAYOUT") return "info";
  return "default";
}

function txTypeLabel(type: string) {
  const map: Record<string, string> = {
    TOPUP: "Top-up",
    CREDIT: "Credit",
    DEBIT: "Debit",
    PAYOUT: "Payout",
    REFUND: "Refund",
    FEE: "Fee",
    TASK_PAYMENT: "Task payment",
    WITHDRAWAL: "Withdrawal",
    ADJUSTMENT: "Adjustment",
  };
  return map[type] ?? type;
}

function statusDot(status: string) {
  const cls =
    status === "COMPLETED"
      ? "bg-emerald-500"
      : status === "PENDING"
        ? "bg-amber-400"
        : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
      <span className="capitalize">{status.toLowerCase()}</span>
    </span>
  );
}

// ── component ──────────────────────────────────────────────────────────────
export default function BillingPage() {
  // data state
  const [wallet, setWallet] = useState<Wallet>(DEFAULT_WALLET);
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // top-up drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [topUpMethod, setTopUpMethod] = useState<TopUpMethod>("MPESA");
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [topUpStep, setTopUpStep] = useState<TopUpStep>("FORM");
  const [topUpRef, setTopUpRef] = useState<string | null>(null);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // tx filter
  const [txFilter, setTxFilter] = useState<TxFilter>("ALL");

  // auto-recharge
  const [autoRecharge, setAutoRecharge] = useState(false);
  const [autoThreshold, setAutoThreshold] = useState(500);
  const [autoAmount, setAutoAmount] = useState(1000);
  const [savingAuto, setSavingAuto] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [w, t, i, p] = await Promise.all([
        apiGet<Wallet>("/wallet").catch(() => null),
        apiGet<WalletTransaction[]>("/wallet/transactions").catch(() => [] as WalletTransaction[]),
        apiGet<Invoice[]>("/payments/invoices").catch(() => [] as Invoice[]),
        apiGet<Plan[]>("/payments/plans").catch(() => [] as Plan[]),
      ]);

      if (w) {
        const mapped: Wallet = {
          ...DEFAULT_WALLET,
          ...(w as any),
          balance: (w as any).balance ?? Number((w as any).balanceCents ?? 0) / 100,
        };
        setWallet(mapped);
        setAutoRecharge(mapped.autoRechargeEnabled ?? false);
        setAutoThreshold(mapped.autoRechargeThreshold ?? 500);
        setAutoAmount(mapped.autoRechargeAmount ?? 1000);
      }

      const txItems = extractItems<WalletTransaction>(t);
      setTxs(txItems);
      setInvoices(extractItems<Invoice>(i));
      setPlans(extractItems<Plan>(p));

      try {
        const pm = await apiGet<PaymentMethod[]>("/payments/methods");
        setPayMethods(extractItems<PaymentMethod>(pm));
      } catch { setPayMethods([]); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // stop polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── top-up flow ────────────────────────────────────────────────────────
  const openDrawer = () => {
    setDrawerOpen(true);
    setTopUpStep("FORM");
    setTopUpError(null);
    setTopUpRef(null);
    setTopUpAmount(1000);
  };

  const closeDrawer = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setDrawerOpen(false);
    setTopUpStep("FORM");
    setTopUpError(null);
    setTopUpRef(null);
  };

  const startTopUp = async () => {
    setTopUpError(null);
    if (topUpAmount < 50) { setTopUpError("Minimum top-up is KES 50"); return; }
    if (topUpMethod === "MPESA" && !mpesaPhone.match(/^(\+254|254|07|01)\d{8,9}$/)) {
      setTopUpError("Enter a valid Safaricom number e.g. 0712 345 678");
      return;
    }

    try {
      const res = await apiPost<any>("/wallet/topup", {
        amountCents: Math.round(topUpAmount * 100),
        method: topUpMethod,
        phone: topUpMethod === "MPESA" ? mpesaPhone : undefined,
      });

      const ref: string = (res as any).reference ?? (res as any).data?.reference;

      if (topUpMethod === "CARD" || (res as any).status === "COMPLETED" || (res as any).data?.status === "COMPLETED") {
        // Immediate success
        const newBalance = (res as any).balance ?? (res as any).data?.balance ?? wallet.balance + topUpAmount;
        setWallet((prev) => ({ ...prev, balance: newBalance }));
        await load();
        setTopUpStep("SUCCESS");
        return;
      }

      // M-Pesa pending — start polling
      setTopUpRef(ref);
      setTopUpStep("AWAITING");

      pollRef.current = setInterval(async () => {
        try {
          const poll = await apiGet<any>(`/wallet/topup/${ref}/status`);
          const status = (poll as any).status ?? (poll as any).data?.status;
          if (status === "COMPLETED") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            const newBalance = (poll as any).balance ?? (poll as any).data?.balance ?? wallet.balance + topUpAmount;
            setWallet((prev) => ({ ...prev, balance: newBalance }));
            await load();
            setTopUpStep("SUCCESS");
          } else if (status === "FAILED") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setTopUpError("Payment failed or was cancelled. Please try again.");
            setTopUpStep("FORM");
          }
        } catch { /* keep polling */ }
      }, 3000);
    } catch (e: unknown) {
      setTopUpError(e instanceof Error ? e.message : "Failed to initiate top-up");
    }
  };

  const saveAutoRecharge = async () => {
    setSavingAuto(true);
    try {
      await apiPatch("/wallet/auto-recharge", { enabled: autoRecharge, threshold: autoThreshold, amount: autoAmount });
      setWallet((prev) => ({ ...prev, autoRechargeEnabled: autoRecharge, autoRechargeThreshold: autoThreshold, autoRechargeAmount: autoAmount }));
    } catch { /* noop */ } finally { setSavingAuto(false); }
  };

  // ── transactions filtered ──────────────────────────────────────────────
  const filteredTxs = txs.filter((t) => {
    const type = (t as any).type as string;
    if (txFilter === "ALL") return true;
    if (txFilter === "TOPUP") return type === "TOPUP" || type === "CREDIT";
    if (txFilter === "DEBIT") return type === "DEBIT" || type === "FEE" || type === "WITHDRAWAL";
    if (txFilter === "PAYOUT") return type === "PAYOUT";
    return true;
  });

  const txCols: Column<WalletTransaction>[] = [
    { key: "date", header: "Date", cell: (t) => <span className="text-xs text-zinc-500">{fmtDate(t.createdAt)}</span> },
    {
      key: "type", header: "Type",
      cell: (t) => (
        <Badge tone={txTypeTone(t.type)}>
          {txTypeLabel(t.type)}
        </Badge>
      ),
    },
    { key: "desc", header: "Description", cell: (t) => <span className="text-sm">{t.description || "—"}</span> },
    {
      key: "amount", header: "Amount",
      cell: (t) => {
        const isCredit = ["TOPUP", "CREDIT", "REFUND"].includes(t.type);
        const amt = typeof t.amount === "number" ? t.amount : Number((t as any).amountCents ?? 0) / 100;
        return (
          <span className={`font-medium tabular-nums ${isCredit ? "text-emerald-600" : "text-zinc-800 dark:text-zinc-100"}`}>
            {isCredit ? "+" : "-"}{fmtMoney(amt, t.currency || wallet.currency)}
          </span>
        );
      },
    },
    { key: "status", header: "Status", cell: (t) => statusDot(t.status) },
    { key: "ref", header: "Ref", cell: (t) => t.reference ? <span className="font-mono text-[10px] text-zinc-400">{t.reference.slice(0, 16)}</span> : <span className="text-zinc-300">—</span> },
  ];

  const invCols: Column<Invoice>[] = [
    { key: "num", header: "Invoice", cell: (i) => <span className="font-medium">{i.number}</span> },
    { key: "amt", header: "Amount", cell: (i) => fmtMoney(i.amount, i.currency) },
    {
      key: "status", header: "Status",
      cell: (i) => <Badge tone={i.status === "PAID" ? "success" : i.status === "OVERDUE" ? "danger" : "info"}>{i.status}</Badge>,
    },
    { key: "issued", header: "Issued", cell: (i) => fmtDate(i.issuedAt, { dateStyle: "medium" }) },
    { key: "due", header: "Due", cell: (i) => fmtDate(i.dueAt, { dateStyle: "medium" }) },
    {
      key: "dl", header: "",
      cell: (i) => (
        <button
          onClick={() => downloadInvoice(i)}
          className="text-[11px] font-medium text-brand-600 hover:underline"
        >
          Download
        </button>
      ),
    },
  ];

  const downloadInvoice = (inv: Invoice) => {
    const lines = [
      "═══════════════════════════════════",
      "         WORKSTREAM INVOICE        ",
      "═══════════════════════════════════",
      `Invoice #:  ${inv.number}`,
      `Status:     ${inv.status}`,
      `Issued:     ${fmtDate(inv.issuedAt, { dateStyle: "long" })}`,
      `Due:        ${fmtDate(inv.dueAt, { dateStyle: "long" })}`,
      inv.paidAt ? `Paid:       ${fmtDate(inv.paidAt, { dateStyle: "long" })}` : "",
      "───────────────────────────────────",
      `TOTAL:      ${fmtMoney(inv.amount, inv.currency)}`,
      "═══════════════════════════════════",
    ].filter(Boolean).join("\n");

    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${inv.number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── render ─────────────────────────────────────────────────────────────
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const available = wallet.balance - (wallet.reservedBalance ?? 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        subtitle="Manage your wallet, transactions, subscription, and invoices."
        action={<Button onClick={openDrawer}>Top up wallet</Button>}
      />

      {/* ── Balance stat cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Wallet balance" value={fmtMoney(wallet.balance, wallet.currency)} />
        <StatCard label="Reserved" value={fmtMoney(wallet.reservedBalance ?? 0, wallet.currency)} />
        <StatCard label="Available" value={fmtMoney(available, wallet.currency)} />
      </div>

      {/* ── Plans ── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Subscription plans</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-zinc-400">No active plans available.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((p, idx) => {
              const isPopular = idx === 1;
              return (
                <Card
                  key={p.id}
                  className={`relative flex flex-col ${isPopular ? "border-brand-400 dark:border-brand-500 ring-1 ring-brand-400" : ""}`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-4 rounded-full bg-brand-600 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Most popular
                    </span>
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</h3>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{(p as any).description ?? ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-brand-600">
                        {fmtMoney(p.price ?? 0, p.currency ?? "KES")}
                      </p>
                      <p className="text-[10px] text-zinc-400">/ {(p.interval ?? "month").toLowerCase()}</p>
                    </div>
                  </div>
                  <ul className="mt-4 flex-1 space-y-1.5">
                    {((p.features ?? []) as string[]).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-5 w-full" variant={isPopular ? "primary" : "outline"}>
                    Choose {p.name}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Wallet transactions ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Transactions</h2>
          <div className="flex gap-1.5">
            {(["ALL", "TOPUP", "DEBIT", "PAYOUT"] as TxFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTxFilter(f)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  txFilter === f
                    ? "bg-brand-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {f === "ALL" ? "All" : f === "TOPUP" ? "Top-ups" : f === "DEBIT" ? "Debits" : "Payouts"}
              </button>
            ))}
          </div>
        </div>
        {filteredTxs.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            message={txFilter === "ALL" ? "Transactions will appear here after your first top-up." : `No ${txFilter.toLowerCase()} transactions found.`}
          />
        ) : (
          <DataTable<WalletTransaction> columns={txCols} rows={filteredTxs} rowKey={(r) => r.id} />
        )}
      </section>

      {/* ── Auto-recharge + Payment methods ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Auto-recharge</h3>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-200">
            <div
              onClick={() => setAutoRecharge((v) => !v)}
              className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors ${autoRecharge ? "bg-brand-600" : "bg-zinc-300 dark:bg-zinc-600"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${autoRecharge ? "translate-x-4" : "translate-x-1"}`} />
            </div>
            Recharge automatically when balance drops below threshold
          </label>
          {autoRecharge && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <Label>Threshold (KES)</Label>
                <Input type="number" min={0} value={autoThreshold} onChange={(e) => setAutoThreshold(Number(e.target.value))} />
              </div>
              <div>
                <Label>Recharge amount (KES)</Label>
                <Input type="number" min={0} value={autoAmount} onChange={(e) => setAutoAmount(Number(e.target.value))} />
              </div>
            </div>
          )}
          <Button size="sm" className="mt-4" variant="outline" onClick={saveAutoRecharge} disabled={savingAuto}>
            {savingAuto ? "Saving..." : "Save settings"}
          </Button>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Payment methods</h3>
            <button className="text-[11px] font-medium text-brand-600 hover:underline">+ Add method</button>
          </div>
          {payMethods.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 py-6 text-center dark:border-zinc-700">
              <p className="text-xs text-zinc-400">No payment methods on file.</p>
              <button className="mt-2 text-xs font-medium text-brand-600 hover:underline">Add M-Pesa or card</button>
            </div>
          ) : (
            <ul className="space-y-2">
              {payMethods.map((pm) => (
                <li key={pm.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-10 items-center justify-center rounded bg-zinc-100 text-[10px] font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {pm.type === "MPESA" ? "M-P" : pm.brand ?? pm.type.slice(0, 4)}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{pm.label}</span>
                      {pm.isDefault && <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-300">Default</span>}
                    </div>
                  </div>
                  <div className="flex gap-3 text-[11px]">
                    {!pm.isDefault && (
                      <button
                        onClick={() => setPayMethods((prev) => prev.map((p) => ({ ...p, isDefault: p.id === pm.id })))}
                        className="text-brand-600 hover:underline"
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => setPayMethods((prev) => prev.filter((p) => p.id !== pm.id))}
                      className="text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Invoices ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invoices</h2>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet" message="Invoices will appear here once generated." />
        ) : (
          <DataTable<Invoice> columns={invCols} rows={invoices} rowKey={(r) => r.id} />
        )}
      </section>

      {/* ══════════════════════════════════════════════════════
          TOP-UP SLIDE-OVER DRAWER
      ══════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={topUpStep === "AWAITING" ? undefined : closeDrawer}
          />

          {/* panel */}
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-zinc-900">
            {/* header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Top up wallet</h2>
                <p className="text-xs text-zinc-400">Current balance: {fmtMoney(wallet.balance, wallet.currency)}</p>
              </div>
              {topUpStep !== "AWAITING" && (
                <button
                  onClick={closeDrawer}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              )}
            </div>

            {/* body */}
            <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">

              {/* ── FORM step ── */}
              {topUpStep === "FORM" && (
                <div className="space-y-6">
                  {/* Method toggle */}
                  <div>
                    <Label>Payment method</Label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {(["MPESA", "CARD"] as TopUpMethod[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setTopUpMethod(m)}
                          className={`flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors ${
                            topUpMethod === m
                              ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                              : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                          }`}
                        >
                          {m === "MPESA" ? (
                            <>
                              <span className="text-base">📱</span> M-Pesa
                            </>
                          ) : (
                            <>
                              <span className="text-base">💳</span> Card
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick amounts */}
                  <div>
                    <Label>Amount (KES)</Label>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {QUICK_AMOUNTS.map((a) => (
                        <button
                          key={a}
                          onClick={() => setTopUpAmount(a)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            topUpAmount === a
                              ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                              : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                          }`}
                        >
                          {a.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2">
                      <Input
                        type="number"
                        min={50}
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(Number(e.target.value))}
                        placeholder="Or enter custom amount"
                      />
                    </div>
                  </div>

                  {/* M-Pesa phone */}
                  {topUpMethod === "MPESA" && (
                    <div>
                      <Label>M-Pesa phone number</Label>
                      <Input
                        type="tel"
                        value={mpesaPhone}
                        onChange={(e) => setMpesaPhone(e.target.value)}
                        placeholder="e.g. 0712 345 678"
                        autoFocus
                      />
                      <p className="mt-1 text-xs text-zinc-400">
                        An STK push will be sent to this number. Enter your M-Pesa PIN to complete.
                      </p>
                    </div>
                  )}

                  {topUpMethod === "CARD" && (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Card payments are processed securely. Your saved card will be charged.
                      </p>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="rounded-lg bg-brand-50 px-4 py-3 dark:bg-brand-950">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">You pay</span>
                      <span className="font-semibold text-brand-700 dark:text-brand-300">
                        {fmtMoney(topUpAmount, wallet.currency)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span className="text-zinc-400">New balance after top-up</span>
                      <span className="text-zinc-600 dark:text-zinc-300">
                        {fmtMoney(wallet.balance + topUpAmount, wallet.currency)}
                      </span>
                    </div>
                  </div>

                  {topUpError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                      {topUpError}
                    </p>
                  )}
                </div>
              )}

              {/* ── AWAITING step ── */}
              {topUpStep === "AWAITING" && (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950">
                    <svg className="h-8 w-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Awaiting M-Pesa payment</h3>
                  <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                    An STK push has been sent to <strong className="text-zinc-700 dark:text-zinc-200">{mpesaPhone}</strong>.
                    Enter your M-Pesa PIN on your phone to complete the payment of{" "}
                    <strong className="text-brand-600">{fmtMoney(topUpAmount, wallet.currency)}</strong>.
                  </p>
                  <p className="mt-4 text-xs text-zinc-400">Checking payment status automatically...</p>
                  <button
                    onClick={() => {
                      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                      setTopUpStep("FORM");
                    }}
                    className="mt-6 text-xs text-zinc-400 hover:text-zinc-600 underline"
                  >
                    Cancel and go back
                  </button>
                </div>
              )}

              {/* ── SUCCESS step ── */}
              {topUpStep === "SUCCESS" && (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
                    <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Top-up successful!</h3>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <strong className="text-brand-600">{fmtMoney(topUpAmount, wallet.currency)}</strong> has been added to your wallet.
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    New balance: <strong className="text-zinc-800 dark:text-zinc-100">{fmtMoney(wallet.balance, wallet.currency)}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
              {topUpStep === "FORM" && (
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={startTopUp}>
                    {topUpMethod === "MPESA" ? "Send STK Push" : "Pay now"}
                  </Button>
                  <Button variant="ghost" onClick={closeDrawer}>Cancel</Button>
                </div>
              )}
              {topUpStep === "SUCCESS" && (
                <Button className="w-full" onClick={closeDrawer}>Done</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
