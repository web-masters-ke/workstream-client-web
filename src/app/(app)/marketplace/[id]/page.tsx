"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { LoadingState, PageHeader } from "@/components/ui";

interface BidDetail {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail: string;
  agentRating: number;
  agentCompletedTasks: number;
  agentSkills: string[];
  agentType: string;
  proposedCents: number;
  coverNote: string;
  estimatedDays: number | null;
  status: string;
  rejectionNote: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  category: string | null;
  requiredSkills: string[];
  budgetCents: number;
  currency: string;
  dueAt: string;
  marketplaceStatus: string;
  marketplaceExpiresAt: string | null;
  maxBids: number | null;
  locationText: string | null;
  attachments: string[];
  businessId: string;
  businessName: string;
  businessLogo: string | null;
  businessCity: string | null;
  bidCount: number;
  adminRejectNote: string | null;
  createdAt: string;
  myBid: BidDetail | null;
}

function fmtMoney(cents: number, currency = "KES") {
  return `${currency} ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    WITHDRAWN: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    ACTIVE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    CLOSED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  };
  const cls = map[status] ?? "bg-zinc-100 text-zinc-500";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-[11px] text-zinc-500">{Number(rating).toFixed(1)}</span>
    </span>
  );
}

function BidCard({
  bid,
  isOwner,
  onAccept,
  onReject,
  acting,
}: {
  bid: BidDetail;
  isOwner: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  acting: string | null;
}) {
  return (
    <div className={`rounded-2xl border p-5 transition-all ${
      bid.status === "ACCEPTED"
        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold uppercase text-brand-600 dark:bg-brand-950 dark:text-brand-400">
            {bid.agentName.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{bid.agentName}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <StarRating rating={bid.agentRating} />
              <span className="text-[11px] text-zinc-400">{bid.agentCompletedTasks} tasks done</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${bid.agentType === "FREELANCER" ? "bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {bid.agentType === "FREELANCER" ? "Freelancer" : "Employee"}
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
            {fmtMoney(bid.proposedCents)}
          </p>
          {bid.estimatedDays && (
            <p className="text-[11px] text-zinc-400">{bid.estimatedDays} day{bid.estimatedDays !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {/* Skills */}
      {bid.agentSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {bid.agentSkills.slice(0, 5).map((s) => (
            <span key={s} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{s}</span>
          ))}
        </div>
      )}

      {/* Cover note */}
      <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
        <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">"{bid.coverNote}"</p>
      </div>

      {bid.rejectionNote && (
        <p className="mt-2 text-xs text-red-500">Rejection note: {bid.rejectionNote}</p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {statusBadge(bid.status)}
          <span className="text-[11px] text-zinc-400">{fmtDate(bid.createdAt)}</span>
        </div>

        {isOwner && bid.status === "PENDING" && (
          <div className="flex gap-2">
            <button
              onClick={() => onReject(bid.id)}
              disabled={acting === bid.id}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Decline
            </button>
            <button
              onClick={() => onAccept(bid.id)}
              disabled={acting === bid.id}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
            >
              {acting === bid.id ? "Accepting…" : "Accept bid"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [bids, setBids] = useState<BidDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Bid form state
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidNote, setBidNote] = useState("");
  const [bidDays, setBidDays] = useState("");
  const [bidBusy, setBidBusy] = useState(false);
  const [bidMsg, setBidMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  useEffect(() => {
    const user = (() => { try { return JSON.parse(localStorage.getItem("ws-user") ?? "{}"); } catch { return {}; } })();
    setRole(user?.role ?? "");
  }, []);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ListingDetail>(`/marketplace/${id}`);
      setListing(data);

      const user = (() => { try { return JSON.parse(localStorage.getItem("ws-user") ?? "{}"); } catch { return {}; } })();
      const userRole = user?.role ?? "";
      setRole(userRole);

      if (userRole !== "AGENT") {
        try {
          const bidsData = await apiGet<BidDetail[]>(`/marketplace/${id}/bids`);
          setBids(Array.isArray(bidsData) ? bidsData : []);
          setIsOwner(true);
        } catch {
          setIsOwner(false);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load listing");
    } finally {
      setLoading(false);
    }
  }

  async function submitBid() {
    const cents = Math.round(parseFloat(bidAmount) * 100);
    if (!cents || cents <= 0) { setBidMsg({ ok: false, text: "Enter a valid amount" }); return; }
    if (bidNote.trim().length < 20) { setBidMsg({ ok: false, text: "Cover note must be at least 20 characters" }); return; }
    setBidBusy(true);
    setBidMsg(null);
    try {
      const bid = await apiPost<BidDetail>(`/marketplace/${id}/bids`, {
        proposedCents: cents,
        coverNote: bidNote.trim(),
        estimatedDays: bidDays ? parseInt(bidDays) : undefined,
      });
      setBidMsg({ ok: true, text: "Bid submitted! You'll be notified when the org responds." });
      setListing((prev) => prev ? { ...prev, myBid: bid, bidCount: prev.bidCount + 1 } : prev);
      setShowBidForm(false);
    } catch (e) {
      setBidMsg({ ok: false, text: e instanceof Error ? e.message : "Failed to submit bid" });
    } finally {
      setBidBusy(false);
    }
  }

  async function withdrawBid() {
    if (!listing?.myBid) return;
    setBidBusy(true);
    try {
      await apiPatch(`/marketplace/bids/${listing.myBid.id}/withdraw`, {});
      setListing((prev) => prev ? { ...prev, myBid: { ...prev.myBid!, status: "WITHDRAWN" } } : prev);
      setBidMsg({ ok: true, text: "Bid withdrawn." });
    } catch (e) {
      setBidMsg({ ok: false, text: e instanceof Error ? e.message : "Failed to withdraw" });
    } finally {
      setBidBusy(false);
    }
  }

  async function acceptBid(bidId: string) {
    setActing(bidId);
    try {
      await apiPatch(`/marketplace/${id}/bids/${bidId}/accept`, {});
      setBids((prev) => prev.map((b) => b.id === bidId
        ? { ...b, status: "ACCEPTED", acceptedAt: new Date().toISOString() }
        : b.status === "PENDING" ? { ...b, status: "REJECTED" } : b
      ));
      setListing((prev) => prev ? { ...prev, marketplaceStatus: "ACTIVE" } : prev);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to accept bid");
    } finally {
      setActing(null);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejectBusy(true);
    try {
      await apiPatch(`/marketplace/${id}/bids/${rejectTarget}/reject`, { rejectionNote: rejectNote || undefined });
      setBids((prev) => prev.map((b) => b.id === rejectTarget ? { ...b, status: "REJECTED", rejectionNote: rejectNote } : b));
      setRejectTarget(null);
      setRejectNote("");
    } catch { /* noop */ } finally {
      setRejectBusy(false);
    }
  }

  if (loading) return <LoadingState label="Loading listing…" />;
  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
      {error} <button onClick={load} className="ml-2 underline">Retry</button>
    </div>
  );
  if (!listing) return null;

  const canBid = role === "AGENT";
  const hasBid = !!listing.myBid;
  const bidIsPending = hasBid && listing.myBid!.status === "PENDING";
  const bidIsAccepted = hasBid && listing.myBid!.status === "ACCEPTED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to marketplace
      </button>

      {/* Listing header */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(listing.marketplaceStatus)}
              {listing.category && (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {listing.category}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">{listing.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
              {listing.businessLogo ? (
                <img src={listing.businessLogo} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-500">
                  {listing.businessName[0]}
                </span>
              )}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{listing.businessName}</span>
              {listing.businessCity && <><span>·</span><span>{listing.businessCity}</span></>}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-5 py-4 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {fmtMoney(listing.budgetCents, listing.currency)}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-400">posted budget</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Deadline</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{fmtDate(listing.dueAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Bids received</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{listing.bidCount}{listing.maxBids ? ` / ${listing.maxBids}` : ""}</p>
          </div>
          {listing.locationText && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Location</p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{listing.locationText}</p>
            </div>
          )}
          {listing.marketplaceExpiresAt && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Listing expires</p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{fmtDate(listing.marketplaceExpiresAt)}</p>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mt-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Description</h2>
          <div className="prose prose-sm max-w-none text-zinc-700 dark:text-zinc-300">
            {listing.description.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        {/* Required skills */}
        {listing.requiredSkills.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Required skills</h2>
            <div className="flex flex-wrap gap-2">
              {listing.requiredSkills.map((s) => (
                <span key={s} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {listing.attachments.length > 0 && (
          <div className="mt-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Attachments</h2>
            <div className="flex flex-wrap gap-2">
              {listing.attachments.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-brand-600 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attachment {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Agent: my bid + bid form ── */}
      {canBid && listing.marketplaceStatus === "APPROVED" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-bold text-zinc-900 dark:text-zinc-50">Your bid</h2>

          {bidIsAccepted && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Your bid was accepted!</p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">The task has been assigned to you. Go to Tasks to get started.</p>
            </div>
          )}

          {!hasBid && !showBidForm && (
            <div className="text-center py-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">You haven't placed a bid on this task yet.</p>
              <button
                onClick={() => setShowBidForm(true)}
                className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
              >
                Place a bid
              </button>
            </div>
          )}

          {bidIsPending && !showBidForm && (
            <div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Bid submitted — awaiting response</p>
                <p className="mt-1 text-xs text-amber-600">Your bid of <strong>{fmtMoney(listing.myBid!.proposedCents)}</strong> is under review.</p>
                <p className="mt-2 text-xs italic text-amber-600">"{listing.myBid!.coverNote}"</p>
              </div>
              <button
                onClick={withdrawBid}
                disabled={bidBusy}
                className="mt-3 text-xs text-red-500 underline disabled:opacity-40"
              >
                {bidBusy ? "Withdrawing…" : "Withdraw bid"}
              </button>
            </div>
          )}

          {(hasBid && listing.myBid!.status === "WITHDRAWN") && !showBidForm && (
            <div>
              <p className="text-sm text-zinc-500 mb-4">You withdrew your previous bid. You can re-bid.</p>
              <button onClick={() => setShowBidForm(true)} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition">
                Re-bid
              </button>
            </div>
          )}

          {showBidForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Your bid amount (KES) <span className="text-red-500">*</span>
                  </label>
                  <p className="mb-1 text-[11px] text-zinc-400">Posted budget: {fmtMoney(listing.budgetCents, listing.currency)}</p>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 8000"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Estimated days to complete
                  </label>
                  <p className="mb-1 text-[11px] text-zinc-400 invisible">·</p>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 5"
                    value={bidDays}
                    onChange={(e) => setBidDays(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Cover note <span className="text-red-500">*</span>
                </label>
                <p className="mb-1 text-[11px] text-zinc-400">Explain why you're the best fit. Minimum 20 characters. Be specific about your approach.</p>
                <textarea
                  rows={5}
                  placeholder="e.g. I have 3 years of experience in data entry and have handled similar projects for fintech companies. I will complete this task within 5 days using your preferred format…"
                  value={bidNote}
                  onChange={(e) => setBidNote(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
                <p className="mt-1 text-right text-[11px] text-zinc-400">{bidNote.length} chars</p>
              </div>
              {bidMsg && (
                <p className={`rounded-lg p-3 text-xs ${bidMsg.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"}`}>
                  {bidMsg.text}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={submitBid}
                  disabled={bidBusy || !bidAmount || bidNote.length < 20}
                  className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-40"
                >
                  {bidBusy ? "Submitting…" : "Submit bid"}
                </button>
                <button
                  onClick={() => { setShowBidForm(false); setBidMsg(null); }}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Org owner: bids list ── */}
      {isOwner && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Bids received <span className="ml-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{bids.length}</span>
            </h2>
            {listing.marketplaceStatus === "APPROVED" && (
              <a href={`/marketplace/${id}/manage`} className="text-xs text-brand-600 hover:underline">Manage listing</a>
            )}
          </div>

          {bids.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
              No bids yet. Share your listing to attract freelancers and agents.
            </div>
          ) : (
            <div className="space-y-3">
              {bids.map((bid) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  isOwner={isOwner}
                  onAccept={acceptBid}
                  onReject={(id) => { setRejectTarget(id); setRejectNote(""); }}
                  acting={acting}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Decline this bid</h3>
            <p className="mt-1 text-xs text-zinc-500">Optionally tell the agent why their bid wasn't selected.</p>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. We're looking for someone with more specific experience in…"
              className="mt-3 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={confirmReject} disabled={rejectBusy}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition">
                {rejectBusy ? "Declining…" : "Decline bid"}
              </button>
              <button onClick={() => setRejectTarget(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
