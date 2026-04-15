"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import { LoadingState, EmptyState, PageHeader } from "@/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type MarketplaceStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ACTIVE"
  | "CLOSED"
  | "EXPIRED";

interface BidSummary {
  total: number;
  pending: number;
  accepted: number;
}

interface MyListing {
  id: string;
  title: string;
  description: string;
  category: string | null;
  requiredSkills: string[];
  budgetCents: number;
  currency: string;
  dueAt: string;
  locationText: string | null;
  marketplaceStatus: MarketplaceStatus;
  adminRejectNote: string | null;
  isMarketplace: boolean;
  maxBids: number | null;
  marketplaceExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  bids: BidSummary;
}

interface MyListingsResult {
  items: MyListing[];
  total: number;
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

function fmtDeadline(iso: string) {
  const d = new Date(iso);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: "Overdue", urgent: true };
  if (diff === 0) return { label: "Today", urgent: true };
  if (diff === 1) return { label: "Tomorrow", urgent: true };
  if (diff <= 3) return { label: `${diff}d left`, urgent: true };
  if (diff <= 7) return { label: `${diff}d left`, urgent: false };
  return { label: d.toLocaleDateString("en-KE", { day: "numeric", month: "short" }), urgent: false };
}

const STATUS_STYLES: Record<MarketplaceStatus, { label: string; bg: string; text: string; dot: string }> = {
  DRAFT:          { label: "Draft",          bg: "bg-zinc-100 dark:bg-zinc-800",   text: "text-zinc-500 dark:text-zinc-400",   dot: "bg-zinc-400" },
  PENDING_REVIEW: { label: "Under Review",   bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  APPROVED:       { label: "Approved",       bg: "bg-sky-50 dark:bg-sky-900/30",   text: "text-sky-700 dark:text-sky-400",    dot: "bg-sky-500" },
  REJECTED:       { label: "Rejected",       bg: "bg-red-50 dark:bg-red-900/30",   text: "text-red-700 dark:text-red-400",    dot: "bg-red-500" },
  ACTIVE:         { label: "Active",         bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  CLOSED:         { label: "Closed",         bg: "bg-zinc-100 dark:bg-zinc-800",   text: "text-zinc-500 dark:text-zinc-400",  dot: "bg-zinc-400" },
  EXPIRED:        { label: "Expired",        bg: "bg-red-50 dark:bg-red-900/30",   text: "text-red-600 dark:text-red-400",    dot: "bg-red-400" },
};

function StatusBadge({ status }: { status: MarketplaceStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function SkillPill({ skill }: { skill: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
      {skill}
    </span>
  );
}

// ─── Close confirmation modal ─────────────────────────────────────────────────

function CloseModal({
  listing,
  onConfirm,
  onCancel,
  loading,
}: {
  listing: MyListing;
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
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h3 className="mb-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
          Close this listing?
        </h3>
        <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{listing.title}</span>
        </p>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          This will stop accepting new bids. Existing pending bids will remain. You can't reopen a closed listing.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
          >
            Keep open
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {loading ? "Closing…" : "Yes, close it"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  onClose,
}: {
  listing: MyListing;
  onClose: (l: MyListing) => void;
}) {
  const deadline = fmtDeadline(listing.dueAt);
  const canClose = listing.marketplaceStatus === "APPROVED" || listing.marketplaceStatus === "ACTIVE";
  const hasAcceptedBid = listing.bids.accepted > 0;

  return (
    <div className="group relative flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <StatusBadge status={listing.marketplaceStatus} />
            {listing.category && (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                {listing.category}
              </span>
            )}
          </div>
          <Link href={`/marketplace/${listing.id}`} className="group/title">
            <h3 className="text-base font-bold text-zinc-900 group-hover/title:text-brand-700 dark:text-zinc-100 dark:group-hover/title:text-brand-400 transition-colors line-clamp-2">
              {listing.title}
            </h3>
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
            {listing.description}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
            {fmtMoney(listing.budgetCents, listing.currency)}
          </div>
          <div className={`text-xs font-semibold mt-0.5 ${deadline.urgent ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
            Due: {deadline.label}
          </div>
        </div>
      </div>

      {/* Rejection note */}
      {listing.marketplaceStatus === "REJECTED" && listing.adminRejectNote && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <span className="font-semibold">Rejection reason:</span> {listing.adminRejectNote}
        </div>
      )}

      {/* Skills */}
      {listing.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {listing.requiredSkills.slice(0, 6).map((s) => (
            <SkillPill key={s} skill={s} />
          ))}
          {listing.requiredSkills.length > 6 && (
            <span className="text-xs text-zinc-400">+{listing.requiredSkills.length - 6} more</span>
          )}
        </div>
      )}

      {/* Footer: stats + actions */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        {/* Bid stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
            </svg>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{listing.bids.total}</span>
            <span className="text-zinc-400">bids</span>
          </div>
          {listing.bids.pending > 0 && (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span className="text-zinc-500 dark:text-zinc-400">{listing.bids.pending} pending</span>
            </div>
          )}
          {hasAcceptedBid && (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-600 font-semibold dark:text-emerald-400">Bid accepted</span>
            </div>
          )}
          {listing.locationText && (
            <div className="flex items-center gap-1 text-zinc-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs">{listing.locationText}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {listing.bids.total > 0 && (
            <Link
              href={`/marketplace/${listing.id}?tab=bids`}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Review bids ({listing.bids.total})
            </Link>
          )}
          {canClose && !hasAcceptedBid && (
            <button
              onClick={() => onClose(listing)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 transition-colors"
            >
              Close listing
            </button>
          )}
          <span className="text-xs text-zinc-400">
            Posted {fmtDate(listing.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Stats overview strip ─────────────────────────────────────────────────────

function StatsStrip({ listings }: { listings: MyListing[] }) {
  const totalBids = listings.reduce((s, l) => s + l.bids.total, 0);
  const pendingReview = listings.filter((l) => l.marketplaceStatus === "PENDING_REVIEW").length;
  const active = listings.filter((l) => l.marketplaceStatus === "ACTIVE" || l.marketplaceStatus === "APPROVED").length;
  const accepted = listings.filter((l) => l.bids.accepted > 0).length;

  const stats = [
    { label: "Total listings", value: listings.length, color: "text-zinc-900 dark:text-zinc-100" },
    { label: "Active / Approved", value: active, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Under review", value: pendingReview, color: "text-amber-600 dark:text-amber-400" },
    { label: "Total bids received", value: totalBids, color: "text-brand-600 dark:text-brand-400" },
    { label: "Bids accepted", value: accepted, color: "text-sky-600 dark:text-sky-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<{ value: MarketplaceStatus | "ALL"; label: string }> = [
  { value: "ALL",           label: "All" },
  { value: "PENDING_REVIEW",label: "Under Review" },
  { value: "APPROVED",      label: "Approved" },
  { value: "ACTIVE",        label: "Active" },
  { value: "REJECTED",      label: "Rejected" },
  { value: "CLOSED",        label: "Closed" },
  { value: "EXPIRED",       label: "Expired" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MarketplaceStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  // Close modal state
  const [closingListing, setClosingListing] = useState<MyListing | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet<MyListingsResult>("/marketplace/my-listings");
      setListings(Array.isArray(res) ? res : res.items ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClose = async () => {
    if (!closingListing) return;
    setCloseLoading(true);
    setCloseError(null);
    try {
      await apiPatch(`/marketplace/${closingListing.id}/close`, {});
      setClosingListing(null);
      await load();
    } catch (e: any) {
      setCloseError(e?.response?.data?.message || "Failed to close listing");
    } finally {
      setCloseLoading(false);
    }
  };

  const filtered = listings.filter((l) => {
    if (statusFilter !== "ALL" && l.marketplaceStatus !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!l.title.toLowerCase().includes(q) && !l.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sortedListings = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (loading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      {/* Header */}
      <PageHeader
        title="My Listings"
        subtitle="Manage the marketplace tasks you've posted"
        action={
          <Link
            href="/marketplace/post"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Post new task
          </Link>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats strip */}
      {listings.length > 0 && <StatsStrip listings={listings} />}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.value === "ALL"
                ? listings.length
                : listings.filter((l) => l.marketplaceStatus === f.value).length;
            if (f.value !== "ALL" && count === 0) return null;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  statusFilter === f.value
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
          placeholder="Search listings…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-56"
        />
      </div>

      {/* Listings */}
      {sortedListings.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 p-16 text-center dark:border-zinc-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          {listings.length === 0 ? (
            <>
              <h3 className="mb-2 text-base font-bold text-zinc-700 dark:text-zinc-300">No listings yet</h3>
              <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
                Post your first task to the marketplace and let free agents bid for it.
              </p>
              <Link
                href="/marketplace/post"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                Post a task
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">No listings match</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Try clearing your filters.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onClose={setClosingListing} />
          ))}
        </div>
      )}

      {/* Tip */}
      <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 dark:border-brand-900/30 dark:bg-brand-900/10">
        <div className="flex gap-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-brand-700 dark:text-brand-300">
            <span className="font-semibold">How it works:</span> New listings go to admin review before going live.
            Once approved, free agents can browse and submit bids. You review bids, accept one, and the task is assigned
            automatically. Payment is released to the agent when you mark the task as completed.
          </div>
        </div>
      </div>

      {/* Close modal */}
      {closingListing && (
        <CloseModal
          listing={closingListing}
          onConfirm={handleClose}
          onCancel={() => { setClosingListing(null); setCloseError(null); }}
          loading={closeLoading}
        />
      )}
      {closeError && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {closeError}
        </div>
      )}
    </div>
  );
}
