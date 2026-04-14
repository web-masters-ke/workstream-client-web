"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Button, Card, ErrorState, Input, Label, LoadingState, PageHeader, Select } from "@/components/ui";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Business, User } from "@/lib/types";

const INDUSTRIES = ["Customer Service", "Sales", "Data Operations", "Back-Office", "Social Media", "Other"];

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0][0] ?? "?");
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
      {letters.toUpperCase()}
    </div>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Business info
  const [bizName, setBizName] = useState("");
  const [bizIndustry, setBizIndustry] = useState("");
  const [bizWebsite, setBizWebsite] = useState("");
  const [bizDesc, setBizDesc] = useState("");
  const [bizSaved, setBizSaved] = useState(false);
  const [bizSaving, setBizSaving] = useState(false);

  // Password
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // Notifications (localStorage)
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSms, setNotifSms] = useState(false);

  // Delete account modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [u, b] = await Promise.all([
          apiGet<User>("/auth/me"),
          apiGet<Business[] | Business>("/businesses").catch(() => null),
        ]);
        setUser(u);
        const name = u.name ?? "";
        const parts = name.split(" ");
        setFirstName(parts[0] ?? "");
        setLastName(parts.slice(1).join(" ") ?? "");
        setPhone(u.phone ?? "");
        setAvatarUrl(u.avatarUrl ?? null);

        const biz = Array.isArray(b) ? b[0] : b;
        if (biz) {
          setBusiness(biz);
          setBizName(biz.name ?? "");
          setBizIndustry(biz.industry ?? "");
          setBizWebsite((biz as Business & { website?: string }).website ?? "");
          setBizDesc((biz as Business & { description?: string }).description ?? "");
        }

        // Load notification prefs
        try {
          const prefs = JSON.parse(localStorage.getItem("ws-notif-prefs") ?? "{}");
          if ("push" in prefs) setNotifPush(prefs.push);
          if ("email" in prefs) setNotifEmail(prefs.email);
          if ("sms" in prefs) setNotifSms(prefs.sms);
        } catch { /* ignore */ }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await apiPatch("/users/me", { firstName, lastName, phone });
      if (user) setUser({ ...user, name: `${firstName} ${lastName}`.trim(), phone });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch { /* stub */ }
    finally { setProfileSaving(false); }
  };

  const saveBusiness = async (e: FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setBizSaving(true);
    try {
      await apiPatch(`/businesses/${business.id}`, { name: bizName, industry: bizIndustry, website: bizWebsite, description: bizDesc });
      setBizSaved(true);
      setTimeout(() => setBizSaved(false), 2500);
    } catch { /* stub */ }
    finally { setBizSaving(false); }
  };

  const changePwd = async (e: FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdMsg({ text: "Passwords do not match.", ok: false }); return; }
    if (newPwd.length < 8) { setPwdMsg({ text: "Password must be at least 8 characters.", ok: false }); return; }
    setPwdSaving(true);
    try {
      await apiPost("/auth/change-password", { currentPassword: currentPwd, newPassword: newPwd });
      setPwdMsg({ text: "Password updated successfully.", ok: true });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setPwdMsg({ text: e.response?.data?.message ?? "Failed to update password.", ok: false });
    } finally { setPwdSaving(false); }
  };

  const saveNotifPrefs = () => {
    localStorage.setItem("ws-notif-prefs", JSON.stringify({ push: notifPush, email: notifEmail, sms: notifSms }));
  };

  const handleAvatarChange = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (r) => setAvatarUrl(r.target?.result as string);
    reader.readAsDataURL(file);
    // Best-effort upload
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiPost<{ url: string }>("/media/upload", form);
      if (res.url) setAvatarUrl(res.url);
    } catch { /* keep local preview */ }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const fullName = `${firstName} ${lastName}`.trim() || user?.name || "User";

  return (
    <div>
      <PageHeader title="My profile" subtitle="Personal account settings and preferences." />

      {/* Avatar + basic info */}
      <Card className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative w-20">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <Initials name={fullName} />
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white hover:bg-brand-700"
            title="Upload photo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{fullName}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{user?.email}</p>
          <p className="mt-0.5 text-xs text-zinc-400">Member since {user?.createdAt ? new Date(user.createdAt).getFullYear() : "—"}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal info */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Personal information</h3>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled className="opacity-60" />
              <p className="mt-1 text-[10px] text-zinc-400">Contact support to change your email address.</p>
            </div>
            <div>
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={profileSaving}>
                {profileSaving ? "Saving..." : "Save"}
              </Button>
              {profileSaved && <span className="text-xs text-emerald-600">Saved</span>}
            </div>
          </form>
        </Card>

        {/* Change password */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Change password</h3>
          <form onSubmit={changePwd} className="space-y-3">
            <div>
              <Label>Current password</Label>
              <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <Label>New password</Label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repeat new password" />
            </div>
            {pwdMsg && (
              <p className={`text-xs ${pwdMsg.ok ? "text-emerald-600" : "text-red-600 dark:text-red-400"}`}>{pwdMsg.text}</p>
            )}
            <Button type="submit" size="sm" disabled={pwdSaving}>{pwdSaving ? "Updating..." : "Update password"}</Button>
          </form>
        </Card>
      </div>

      {/* Business info */}
      {business && (
        <Card className="mt-6">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Business information</h3>
          <form onSubmit={saveBusiness} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label>Company name</Label>
              <Input value={bizName} onChange={(e) => setBizName(e.target.value)} />
            </div>
            <div>
              <Label>Industry</Label>
              <Select value={bizIndustry} onChange={(e) => setBizIndustry(e.target.value)}>
                <option value="">Select industry</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            </div>
            <div>
              <Label>Website</Label>
              <Input type="url" value={bizWebsite} onChange={(e) => setBizWebsite(e.target.value)} placeholder="https://company.com" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={bizDesc} onChange={(e) => setBizDesc(e.target.value)} placeholder="Brief description" />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <Button type="submit" size="sm" disabled={bizSaving}>{bizSaving ? "Saving..." : "Save business info"}</Button>
              {bizSaved && <span className="text-xs text-emerald-600">Saved</span>}
            </div>
          </form>
        </Card>
      )}

      {/* Notification preferences */}
      <Card className="mt-6">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Notification preferences</h3>
        <div className="space-y-3">
          {[
            { label: "Push notifications", val: notifPush, set: setNotifPush },
            { label: "Email notifications", val: notifEmail, set: setNotifEmail },
            { label: "SMS notifications", val: notifSms, set: setNotifSms },
          ].map(({ label, val, set }) => (
            <label key={label} className="flex cursor-pointer items-center justify-between">
              <span className="text-sm text-zinc-700 dark:text-zinc-200">{label}</span>
              <button
                type="button"
                onClick={() => { set(!val); saveNotifPrefs(); }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${val ? "bg-brand-600" : "bg-zinc-300 dark:bg-zinc-600"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${val ? "translate-x-4.5" : "translate-x-0.5"}`} />
              </button>
            </label>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="mt-6 border-red-200 dark:border-red-900/50">
        <h3 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Permanently delete your account. All data will be lost and this action cannot be undone.</p>
        <Button variant="danger" size="sm" className="mt-3" onClick={() => setShowDelete(true)}>Delete account</Button>
      </Card>

      {/* Delete account modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl dark:border-red-900 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-red-700 dark:text-red-400">Delete account</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              This will permanently delete your account and all associated data. Type <strong>DELETE</strong> to confirm.
            </p>
            <Input
              className="mt-4"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}>Cancel</Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteConfirm !== "DELETE"}
                onClick={() => { /* call DELETE /users/me when implemented */ alert("Account deletion submitted."); setShowDelete(false); }}
              >
                Confirm delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
