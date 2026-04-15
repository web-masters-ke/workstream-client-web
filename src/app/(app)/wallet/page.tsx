"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui";

interface Wallet {
  id: string;
  balance: number;
  reservedBalance: number;
  currency: string;
  updatedAt: string;
}

interface Txn {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
}

function fmtMoney(amount: number, currency = "KES") {
  return `${currency} ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function txnColor(type: string) {
  if (type === "TASK_PAYMENT" || type === "TOPUP") return "text-emerald-600 dark:text-emerald-400";
  if (type === "PAYOUT" || type === "WITHDRAWAL") return "text-red-500 dark:text-red-400";
  return "text-zinc-500";
}

function txnSign(type: string) {
  return type === "PAYOUT" || type === "WITHDRAWAL" ? "−" : "+";
}

function statusBadge(status: string) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (status === "COMPLETED") return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`;
  if (status === "PENDING") return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`;
  if (status === "FAILED") return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`;
  return `${base} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400`;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payout modal state
  const [showPayout, setShowPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [w, t] = await Promise.all([
        apiGet<Wallet>("/wallet"),
        apiGet<Txn[]>("/wallet/transactions"),
      ]);
      setWallet(w);
      setTxns(Array.isArray(t) ? t : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }

  async function requestPayout() {
    const cents = Math.round(parseFloat(payoutAmount) * 100);
    if (!cents || cents <= 0) return;
    setPayoutBusy(true);
    setPayoutMsg(null);
    try {
      await apiPost("/wallet/payout", { amountCents: cents, phone: payoutPhone || undefined });
      setPayoutMsg({ ok: true, text: "Payout request submitted. Funds arrive within minutes." });
      setPayoutAmount("");
      setPayoutPhone("");
      load();
    } catch (e) {
      setPayoutMsg({ ok: false, text: e instanceof Error ? e.message : "Payout failed" });
    } finally {
      setPayoutBusy(false);
    }
  }

  const available = (wallet?.balance ?? 0) - (wallet?.reservedBalance ?? 0);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="My Wallet"
        subtitle="Earnings from completed tasks"
        action={
          <button
            onClick={() => { setShowPayout(true); setPayoutMsg(null); }}
            disabled={available <= 0}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700 disabled:opacity-40 transition"
          >
            Withdraw
          </button>
        }
      />

      {loading ? (
        <LoadingState label="Loading wallet..." />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={load} className="ml-3 underline">Retry</button>
        </div>
      ) : (
        <>
          {/* Balance cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Available</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {fmtMoney(available, wallet?.currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">Ready to withdraw</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Reserved</p>
              <p className="mt-1 text-2xl font-extrabold text-zinc-700 dark:text-zinc-200">
                {fmtMoney(wallet?.reservedBalance ?? 0, wallet?.currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">Pending task completion</p>
            </div>
          </div>

          {/* Payout modal */}
          {showPayout && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Withdraw funds</h3>
                <button onClick={() => setShowPayout(false)} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">×</button>
              </div>
              <p className="text-xs text-zinc-500">Funds sent to M-Pesa. Available: {fmtMoney(available, wallet?.currency)}</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Amount ({wallet?.currency})</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 500"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">M-Pesa phone (optional)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 0712345678"
                    value={payoutPhone}
                    onChange={(e) => setPayoutPhone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              {payoutMsg && (
                <p className={`text-xs ${payoutMsg.ok ? "text-emerald-600" : "text-red-500"}`}>{payoutMsg.text}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={requestPayout}
                  disabled={payoutBusy || !payoutAmount}
                  className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40 transition"
                >
                  {payoutBusy ? "Processing…" : "Confirm withdrawal"}
                </button>
                <button
                  onClick={() => setShowPayout(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Transaction history */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Transaction history</h3>
            {txns.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                message="Payments for completed tasks will appear here."
              />
            ) : (
              <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {txns.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{t.description || t.type}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className={statusBadge(t.status)}>{t.status}</span>
                        <span className="text-[11px] text-zinc-400">{fmtDate(t.createdAt)}</span>
                      </div>
                    </div>
                    <p className={`ml-4 shrink-0 text-sm font-bold ${txnColor(t.type)}`}>
                      {txnSign(t.type)}{fmtMoney(t.amount, t.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
