"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { LoadingState, EmptyState, PageHeader } from "@/components/ui";

interface Listing {
  id: string;
  title: string;
  description: string;
  category: string | null;
  requiredSkills: string[];
  budgetCents: number;
  currency: string;
  dueAt: string;
  locationText: string | null;
  businessName: string;
  businessLogo: string | null;
  businessCity: string | null;
  bidCount: number;
  marketplaceStatus: string;
  createdAt: string;
}

interface BrowseResult {
  items: Listing[];
  total: number;
  page: number;
  limit: number;
  categories: string[];
}

type SortOption = "NEWEST" | "BUDGET_HIGH" | "BUDGET_LOW" | "DEADLINE_SOON" | "MOST_BIDS";

const SORT_LABELS: Record<SortOption, string> = {
  NEWEST: "Newest first",
  BUDGET_HIGH: "Highest budget",
  BUDGET_LOW: "Lowest budget",
  DEADLINE_SOON: "Deadline soon",
  MOST_BIDS: "Most bids",
};

function fmtMoney(cents: number, currency = "KES") {
  return `${currency} ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDeadline(iso: string) {
  const d = new Date(iso);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff < 0) return "Overdue";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `${diff} days left`;
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function SkillPill({ skill }: { skill: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
      {skill}
    </span>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const router = useRouter();
  const deadline = new Date(listing.dueAt);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
  const urgent = daysLeft >= 0 && daysLeft <= 3;

  return (
    <div
      onClick={() => router.push(`/marketplace/${listing.id}`)}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-brand-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-700"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-zinc-900 group-hover:text-brand-600 dark:text-zinc-50 dark:group-hover:text-brand-400">
            {listing.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
            {listing.businessLogo ? (
              <img src={listing.businessLogo} alt="" className="h-4 w-4 rounded-full object-cover" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[8px] font-bold uppercase text-zinc-500 dark:bg-zinc-700">
                {listing.businessName[0]}
              </span>
            )}
            {listing.businessName}
            {listing.businessCity && <span className="text-zinc-300 dark:text-zinc-600">·</span>}
            {listing.businessCity}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {fmtMoney(listing.budgetCents, listing.currency)}
          </p>
          <p className="text-[10px] text-zinc-400">budget</p>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {listing.description}
      </p>

      {/* Skills */}
      {listing.requiredSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {listing.requiredSkills.slice(0, 4).map((s) => (
            <SkillPill key={s} skill={s} />
          ))}
          {listing.requiredSkills.length > 4 && (
            <span className="text-[11px] text-zinc-400">+{listing.requiredSkills.length - 4} more</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          {listing.locationText && (
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {listing.locationText}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {listing.bidCount} bid{listing.bidCount !== 1 ? "s" : ""}
          </span>
        </div>
        <span className={`text-[11px] font-semibold ${urgent ? "text-red-500 dark:text-red-400" : "text-zinc-500"}`}>
          {fmtDeadline(listing.dueAt)}
        </span>
      </div>

      {listing.category && (
        <span className="absolute right-3 top-3 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {listing.category}
        </span>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortOption>("NEWEST");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (params: {
    search?: string; category?: string; sort?: SortOption;
    budgetMin?: string; budgetMax?: string; page?: number;
  }) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (params.search) q.set("search", params.search);
      if (params.category) q.set("category", params.category);
      if (params.sort) q.set("sort", params.sort);
      if (params.budgetMin) q.set("budgetMinCents", String(Math.round(Number(params.budgetMin) * 100)));
      if (params.budgetMax) q.set("budgetMaxCents", String(Math.round(Number(params.budgetMax) * 100)));
      q.set("page", String(params.page ?? 1));
      q.set("limit", "18");
      const data = await apiGet<BrowseResult>(`/marketplace?${q.toString()}`);
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      load({ search, category, sort, budgetMin, budgetMax, page });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, category, sort, budgetMin, budgetMax, page, load]);

  const totalPages = result ? Math.ceil(result.total / result.limit) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        subtitle="Browse open tasks posted by organisations. Bid to win work."
        action={
          <Link
            href="/marketplace/post"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-700 transition"
          >
            + Post a task
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-end sm:flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Search</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Keywords, skills, title…"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Category */}
        <div className="min-w-[140px]">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Category</label>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All categories</option>
            {result?.categories.map((c) => (
              <option key={c} value={c!}>{c}</option>
            ))}
          </select>
        </div>

        {/* Budget range */}
        <div className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Min budget (KES)</label>
            <input
              type="number"
              value={budgetMin}
              onChange={(e) => { setBudgetMin(e.target.value); setPage(1); }}
              placeholder="0"
              className="w-28 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <span className="mb-2 text-zinc-400">–</span>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Max</label>
            <input
              type="number"
              value={budgetMax}
              onChange={(e) => { setBudgetMax(e.target.value); setPage(1); }}
              placeholder="∞"
              className="w-28 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Sort */}
        <div className="min-w-[160px]">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">Sort by</label>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {Object.entries(SORT_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {(search || category || budgetMin || budgetMax) && (
          <button
            onClick={() => { setSearch(""); setCategory(""); setBudgetMin(""); setBudgetMax(""); setPage(1); }}
            className="mb-px rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      {result && !loading && (
        <p className="text-xs text-zinc-500">
          {result.total === 0 ? "No listings found" : `${result.total.toLocaleString()} listing${result.total !== 1 ? "s" : ""} found`}
          {(search || category) && " for your filters"}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <LoadingState label="Loading marketplace…" />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="No listings right now"
          message="Check back soon — organisations post new tasks regularly."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = page <= 4 ? i + 1 : page + i - 3;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-9 w-9 rounded-lg text-sm font-medium transition ${
                        p === page
                          ? "bg-brand-600 text-white"
                          : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
