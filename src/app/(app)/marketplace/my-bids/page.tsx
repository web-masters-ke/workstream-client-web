"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiGet, apiPatch } from "@/lib/api";
import { LoadingState, PageHeader } from "@/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type BidStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";

interface BidListing {
  id: string;
  title: string;
  category: string | null;
  budgetCents: number;
  currency: string;
  dueAt: string;
  locationText: string | null;
  marketplaceStatus: string;
  businessName: string;
  businessLogo: string | null;
  businessCity: string | null;
}

interface MyBid {
  id: string;
  taskId: string;
  proposedCents: number;
  coverNote: string | null;
  estimatedDays: number | null;
  status: BidStatus;
  rejectionNote: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
  listing: BidListing;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(cents: number, currency = "KES") {
  return `${currency} ${(cents / 100).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
}

const BID_STATUS_STYLES: Record<BidStatus, { label: string; bg: string; text: string; border: string; dot: string; icon: string }> = {
  PENDING:   { label: "Pending review", bg: "bg-amber-50 dark:bg-amber-900/20",   text: "text-amber-700 dark:text-amber-400",     border: "border-amber-200 dark:border-amber-800", dot: "bg-amber-500", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  ACCEPTED:  { label: "Bid accepted!",  bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  REJECTED:  { label: "Not selected",   bg: "bg-red-50 dark:bg-red-900/20",        text: "text-red-700 dark:text-red-400",          border: "border-red-200 dark:border-red-800",     dot: "bg-red-500",   icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  WITHDRAWN: { label: "Withdrawn",       bg: "bg-zinc-100 dark:bg-zinc-800",        text: "text-zinc-500 dark:text-zinc-400",         border: "border-zinc-200 dark:border-zinc-700",   dot: "bg-zinc-400",  icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
  EXPIRED:   { label: "Expired",         bg: "bg-zinc-100 dark:bg-zinc-800",        text: "text-zinc-400 dark:text-zinc-500",         border: "border-zinc-200 dark:border-zinc-700",   dot: "bg-zinc-300",  icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
};

function BidStatusBadge({ status }: { status: BidStatus }) {
  const s = BID_STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Withdraw modal ───────────────────────────────────────────────────────────

function WithdrawModal({
  bid,
  onConfirm,
  onCancel,
  loading,
}: {
  bid: MyBid;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="mb-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
          Withdraw your bid?
        </h3>
        <p className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{bid.listing.title}</p>
        <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          Your proposed amount: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{fmtMoney(bid.proposedCents, bid.listing.currency)}</span>
        </p>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          This will remove your bid from the listing. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Keep my bid
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Withdrawing…" : "Yes, withdraw it"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bid card ─────────────────────────────────────────────────────────────────

function BidCard({
  bid,
  onWithdraw,
}: {
  bid: MyBid;
  onWithdraw: (b: MyBid) => void;
}) {
  const s = BID_STATUS_STYLES[bid.status];
  const [expanded, setExpanded] = useState(false);
  const budgetDiff = bid.proposedCents - bid.listing.budgetCents;
  const budgetPct = bid.listing.budgetCents > 0
    ? Math.round(((bid.proposedCents - bid.listing.budgetCents) / bid.listing.budgetCents) * 100)
    : 0;

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 ${s.border}`}>
      {/* Accepted banner */}
      {bid.status === "ACCEPTED" && (
        <div className="flex items-center gap-2 rounded-t-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Congratulations — your bid was accepted! The task has been assigned to you.
        </div>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <BidStatusBadge status={bid.status} />
              {bid.listing.category && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {bid.listing.category}
                </span>
              )}
            </div>
            <Link href={`/marketplace/${bid.taskId}`} className="group/title">
              <h3 className="text-base font-bold text-zinc-900 group-hover/title:text-brand-700 dark:text-zinc-100 dark:group-hover/title:text-brand-400 transition-colors line-clamp-2">
                {bid.listing.title}
              </h3>
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{bid.listing.businessName}</span>
              {bid.listing.businessCity && <span>{bid.listing.businessCity}</span>}
              {bid.listing.locationText && (
                <span className="flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  {bid.listing.locationText}
                </span>
              )}
            </div>
          </div>

          {/* Amount comparison */}
          <div className="text-right shrink-0">
            <div className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
              {fmtMoney(bid.proposedCents, bid.listing.currency)}
            </div>
            <div className="text-xs text-zinc-400">Your bid</div>
            <div className={`mt-0.5 text-xs font-semibold ${
              budgetDiff === 0
                ? "text-zinc-400"
                : budgetDiff < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}>
              {budgetDiff === 0 ? "At budget" : budgetDiff < 0 ? `${Math.abs(budgetPct)}% below budget` : `${budgetPct}% above budget`}
            </div>
            <div className="mt-0.5 text-xs text-zinc-400">
              Budget: {fmtMoney(bid.listing.budgetCents, bid.listing.currency)}
            </div>
          </div>
        </div>

        {/* Rejection note */}
        {bid.status === "REJECTED" && bid.rejectionNote && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-900/20">
            <span className="font-semibold text-red-700 dark:text-red-400">Feedback: </span>
            <span className="text-red-600 dark:text-red-400">{bid.rejectionNote}</span>
          </div>
        )}

        {/* Cover note (collapsible) */}
        {bid.coverNote && (
          <div className="mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors"
            >
              <svg className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {expanded ? "Hide cover note" : "Show cover note"}
            </button>
            {expanded && (
              <div className="mt-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 leading-relaxed">
                "{bid.coverNote}"
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span>Bid placed {fmtRelativeTime(bid.createdAt)}</span>
            {bid.estimatedDays && (
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {bid.estimatedDays} day{bid.estimatedDays !== 1 ? "s" : ""} estimated
              </span>
            )}
            {bid.acceptedAt && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Accepted {fmtDate(bid.acceptedAt)}</span>}
            {bid.rejectedAt && <span>Decided {fmtDate(bid.rejectedAt)}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/marketplace/${bid.taskId}`}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
            >
              View listing
            </Link>
            {bid.status === "PENDING" && (
              <button
                onClick={() => onWithdraw(bid)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              >
                Withdraw bid
              </button>
            )}
            {bid.status === "ACCEPTED" && (
              <Link
                href="/tasks"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Go to task →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function BidStats({ bids }: { bids: MyBid[] }) {
  const counts = bids.reduce(
    (acc, b) => ({ ...acc, [b.status]: (acc[b.status as BidStatus] || 0) + 1 }),
    {} as Record<string, number>
  );
  const totalProposed = bids.reduce((s, b) => s + b.proposedCents, 0);
  const acceptedBids = bids.filter((b) => b.status === "ACCEPTED");
  const acceptedValue = acceptedBids.reduce((s, b) => s + b.proposedCents, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {[
        { label: "Total bids", value: bids.length, color: "text-zinc-900 dark:text-zinc-100" },
        { label: "Pending", value: counts.PENDING || 0, color: "text-amber-600 dark:text-amber-400" },
        { label: "Accepted", value: counts.ACCEPTED || 0, color: "text-emerald-600 dark:text-emerald-400" },
        { label: "Not selected", value: counts.REJECTED || 0, color: "text-red-600 dark:text-red-400" },
        { label: "Withdrawn", value: counts.WITHDRAWN || 0, color: "text-zinc-400" },
        { label: "Win rate", value: bids.length > 0 ? `${Math.round(((counts.ACCEPTED || 0) / bids.length) * 100)}%` : "—", color: "text-brand-600 dark:text-brand-400" },
      ].map((s) => (
        <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const BID_FILTERS: Array<{ value: BidStatus | "ALL"; label: string }> = [
  { value: "ALL",       label: "All bids" },
  { value: "PENDING",   label: "Pending" },
  { value: "ACCEPTED",  label: "Accepted" },
  { value: "REJECTED",  label: "Not selected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

export default function MyBidsPage() {
  const [bids, setBids] = useState<MyBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BidStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  // Withdraw state
  const [withdrawingBid, setWithdrawingBid] = useState<MyBid | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet<{ items: MyBid[] } | MyBid[]>("/marketplace/my-bids");
      setBids(Array.isArray(res) ? res : (res as any).items ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load bids");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleWithdraw = async () => {
    if (!withdrawingBid) return;
    setWithdrawLoading(true);
    setWithdrawError(null);
    try {
      await apiPatch(`/marketplace/bids/${withdrawingBid.id}/withdraw`, {});
      setWithdrawingBid(null);
      setToast("Bid withdrawn successfully.");
      await load();
    } catch (e: any) {
      setWithdrawError(e?.response?.data?.message || "Failed to withdraw bid");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const filtered = bids.filter((b) => {
    if (filter !== "ALL" && b.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !b.listing.title.toLowerCase().includes(q) &&
        !b.listing.businessName.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (loading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      {/* Header */}
      <PageHeader
        title="My Bids"
        subtitle="Track all the marketplace tasks you've bid on"
        action={
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Browse marketplace
          </Link>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      {bids.length > 0 && <BidStats bids={bids} />}

      {/* Accepted highlight */}
      {bids.some((b) => b.status === "ACCEPTED") && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                You have {bids.filter((b) => b.status === "ACCEPTED").length} accepted bid{bids.filter((b) => b.status === "ACCEPTED").length !== 1 ? "s" : ""}!
              </div>
              <div className="text-sm text-emerald-600 dark:text-emerald-500">
                These tasks have been assigned to you. Head to Tasks to get started.
              </div>
            </div>
            <Link
              href="/tasks"
              className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
            >
              My tasks →
            </Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {BID_FILTERS.map((f) => {
            const count =
              f.value === "ALL"
                ? bids.length
                : bids.filter((b) => b.status === f.value).length;
            if (f.value !== "ALL" && count === 0) return null;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filter === f.value
                    ? "bg-brand-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
        <input
          type="search"
          placeholder="Search by task or org…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-64"
        />
      </div>

      {/* Bids list */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 p-16 text-center dark:border-zinc-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          {bids.length === 0 ? (
            <>
              <h3 className="mb-2 text-base font-bold text-zinc-700 dark:text-zinc-300">No bids placed yet</h3>
              <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
                Browse the marketplace and start bidding on tasks that match your skills.
              </p>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Browse marketplace
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">No bids match</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Try a different filter.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((bid) => (
            <BidCard key={bid.id} bid={bid} onWithdraw={setWithdrawingBid} />
          ))}
        </div>
      )}

      {/* Tips for agents */}
      {bids.length > 0 && (
        <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-900/30 dark:bg-brand-900/10">
          <div className="flex gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div className="text-sm text-brand-700 dark:text-brand-300">
              <span className="font-semibold">Tip:</span> Bids with detailed cover notes and competitive pricing win 3× more often.
              Keep your skills up to date in your profile to rank higher in search results.
            </div>
          </div>
        </div>
      )}

      {/* Withdraw modal */}
      {withdrawingBid && (
        <WithdrawModal
          bid={withdrawingBid}
          onConfirm={handleWithdraw}
          onCancel={() => { setWithdrawingBid(null); setWithdrawError(null); }}
          loading={withdrawLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-xl dark:bg-zinc-100 dark:text-zinc-900">
          {toast}
        </div>
      )}
      {withdrawError && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {withdrawError}
        </div>
      )}
    </div>
  );
}
