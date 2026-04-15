"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { PageHeader } from "@/components/ui";

const CATEGORIES = [
  "Data Entry", "Research", "Writing & Editing", "Customer Support",
  "Design", "Development", "Marketing", "Finance & Accounting",
  "HR & Recruitment", "Logistics", "Legal", "Other",
];

const COMMON_SKILLS = [
  "Microsoft Excel", "Data Entry", "Customer Service", "Research",
  "Copy Writing", "Social Media", "Graphic Design", "Web Development",
  "Python", "SQL", "Accounting", "Payroll", "Logistics Coordination",
];

export default function PostListingPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [currency] = useState("KES");
  const [dueDate, setDueDate] = useState("");
  const [expiresDate, setExpiresDate] = useState("");
  const [maxBids, setMaxBids] = useState("20");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function addSkill(s: string) {
    const trimmed = s.trim();
    if (trimmed && !skills.includes(trimmed)) setSkills((prev) => [...prev, trimmed]);
    setSkillInput("");
  }

  function removeSkill(s: string) {
    setSkills((prev) => prev.filter((x) => x !== s));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (title.trim().length < 5) errs.title = "Title must be at least 5 characters";
    if (description.trim().length < 20) errs.description = "Description must be at least 20 characters";
    if (!budgetAmount || parseFloat(budgetAmount) <= 0) errs.budget = "Enter a valid budget";
    if (!dueDate) errs.dueDate = "Deadline is required";
    else if (new Date(dueDate) <= new Date()) errs.dueDate = "Deadline must be in the future";
    if (expiresDate && new Date(expiresDate) <= new Date()) errs.expiresDate = "Expiry must be in the future";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setBusy(true);
    setError(null);
    try {
      const listing = await apiPost<{ id: string }>("/marketplace", {
        title: title.trim(),
        description: description.trim(),
        category: category || undefined,
        requiredSkills: skills,
        budgetCents: Math.round(parseFloat(budgetAmount) * 100),
        currency,
        dueAt: new Date(dueDate).toISOString(),
        marketplaceExpiresAt: expiresDate ? new Date(expiresDate).toISOString() : undefined,
        maxBids: parseInt(maxBids) || 20,
        locationText: location.trim() || undefined,
      });
      router.push(`/marketplace/my-listings`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post listing");
    } finally {
      setBusy(false);
    }
  }

  const minDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Post a task"
        subtitle="Describe what you need done. Free agents will bid to complete it."
      />

      {/* Form card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 space-y-6">

        {/* Title */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Task title <span className="text-red-500">*</span>
          </label>
          <p className="mb-2 text-xs text-zinc-500">Be specific and concise. e.g. "Enter 500 customer records into Excel spreadsheet"</p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Data entry for customer database — 500 records"
            maxLength={120}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {fieldErrors.title && <p className="mt-1 text-xs text-red-500">{fieldErrors.title}</p>}
          <p className="mt-1 text-right text-[11px] text-zinc-400">{title.length}/120</p>
        </div>

        {/* Category */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c === category ? "" : c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  category === c
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Full description <span className="text-red-500">*</span>
          </label>
          <p className="mb-2 text-xs text-zinc-500">
            Include: what exactly needs to be done, any specific requirements, format of deliverables, access or tools needed.
          </p>
          <textarea
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`Describe the task in detail:\n\n• What needs to be done\n• Specific requirements or format\n• Any tools or access you'll provide\n• Expected deliverables\n• Any other important details`}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {fieldErrors.description && <p className="mt-1 text-xs text-red-500">{fieldErrors.description}</p>}
          <p className="mt-1 text-right text-[11px] text-zinc-400">{description.length} chars (min 20)</p>
        </div>

        {/* Required skills */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">Required skills</label>
          <p className="mb-2 text-xs text-zinc-500">Add skills that applicants should have. Agents with matching skills see your task first.</p>

          {/* Quick-add chips */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {COMMON_SKILLS.filter((s) => !skills.includes(s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                className="rounded-full border border-dashed border-zinc-300 px-2.5 py-0.5 text-[11px] text-zinc-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                + {s}
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillInput); } }}
              placeholder="Type a skill and press Enter"
              className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() => addSkill(skillInput)}
              disabled={!skillInput.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {/* Selected skills */}
          {skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="text-brand-500 hover:text-brand-800">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Budget + deadline */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Budget (KES) <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-zinc-500">This is the total amount you'll pay to the winning bidder.</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">KES</span>
              <input
                type="number"
                min="1"
                step="any"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-11 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {fieldErrors.budget && <p className="mt-1 text-xs text-red-500">{fieldErrors.budget}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Task deadline <span className="text-red-500">*</span>
            </label>
            <p className="mb-2 text-xs text-zinc-500">When must this task be completed by?</p>
            <div className="relative">
              <input
                type="date"
                value={dueDate}
                min={minDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 pr-10 text-sm text-zinc-900 [color-scheme:light] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            {fieldErrors.dueDate && <p className="mt-1 text-xs text-red-500">{fieldErrors.dueDate}</p>}
          </div>
        </div>

        {/* Advanced settings */}
        <details className="group">
          <summary className="cursor-pointer list-none text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            Advanced settings ▾
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Max bids</label>
              <p className="mb-1 text-[11px] text-zinc-400">Stop accepting bids after this many</p>
              <input
                type="number"
                min="1"
                max="200"
                value={maxBids}
                onChange={(e) => setMaxBids(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Listing expires</label>
              <p className="mb-1 text-[11px] text-zinc-400">Auto-close listing after this date</p>
              <div className="relative">
                <input
                  type="date"
                  value={expiresDate}
                  min={minDate}
                  onChange={(e) => setExpiresDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 [color-scheme:light] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              {fieldErrors.expiresDate && <p className="mt-1 text-xs text-red-500">{fieldErrors.expiresDate}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Location (optional)</label>
              <p className="mb-1 text-[11px] text-zinc-400">e.g. "Nairobi" or "Remote"</p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Nairobi / Remote"
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </details>

        {/* Preview */}
        {budgetAmount && dueDate && (
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-4 dark:border-brand-900/30 dark:bg-brand-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Preview</p>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title || "Your task title"}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
              <span>Budget: <strong className="text-emerald-600">KES {parseFloat(budgetAmount || "0").toLocaleString()}</strong></span>
              <span>Deadline: <strong>{new Date(dueDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</strong></span>
              {skills.length > 0 && <span>Skills: <strong>{skills.slice(0, 3).join(", ")}{skills.length > 3 ? ` +${skills.length - 3}` : ""}</strong></span>}
            </div>
            <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-500">
              ℹ️ Listing goes to admin review before going live on the marketplace.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? "Posting…" : "Post task to marketplace"}
          </button>
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-200 px-5 py-3 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
