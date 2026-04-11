"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, Download, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { initials } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import type { User } from "@/drizzle/schema";

interface ProfileFormProps {
  user: User;
}

interface ImportedGoal {
  title: string;
  why?: string | null;
  category: "health" | "finance" | "writing" | "body" | "mindset" | "custom";
  color?: string | null;
  emoji?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  milestones?: string[];
  startDate?: string | null;
  endDate?: string | null;
  tasks?: Array<{ text: string; isRepeating: boolean }>;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name ?? "");
  const [age, setAge] = useState(user.age?.toString() ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviting, setInviting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          age: age ? parseInt(age, 10) : undefined,
          location: location || undefined,
          bio: bio || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile");
      }

      toast("Profile saved ✓");
      router.refresh();
    } catch {
      toast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail && !invitePhone) {
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail || undefined,
          phone: invitePhone || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send invitation");
      }

      toast("Invitation sent ✓");
      setInviteEmail("");
      setInvitePhone("");
    } catch {
      toast("Failed to send invitation", "error");
    } finally {
      setInviting(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/goals");
      const data = (await response.json()) as { goals: unknown[] };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `northstar-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast("Goals exported ✓");
    } catch {
      toast("Export failed", "error");
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { goals?: ImportedGoal[] } | ImportedGoal[];
      const importedGoals = Array.isArray(parsed) ? parsed : parsed.goals ?? [];

      if (!Array.isArray(importedGoals) || importedGoals.length === 0) {
        throw new Error("No goals found in that file");
      }

      let created = 0;
      for (const goal of importedGoals) {
        const response = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: goal.title,
            why: goal.why ?? undefined,
            category: goal.category,
            color: goal.color ?? "#C4963A",
            emoji: goal.emoji ?? undefined,
            targetValue: goal.targetValue ?? undefined,
            currentValue: goal.currentValue ?? 0,
            unit: goal.unit ?? undefined,
            milestones: goal.milestones ?? [],
            startDate: goal.startDate ?? undefined,
            endDate: goal.endDate ?? undefined,
            tasks: goal.tasks ?? [],
          }),
        });

        if (response.ok) {
          created++;
        }
      }

      if (created === 0) {
        throw new Error("No goals were imported");
      }

      toast(`Imported ${created} goals ✓`);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Import failed", "error");
    } finally {
      event.target.value = "";
      setImporting(false);
    }
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className="hidden lg:block space-y-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gold text-2xl font-bold text-ink"
              title={name || "Your Name"}
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={name} className="h-full w-full object-cover" />
              ) : (
                initials(name)
              )}
            </div>
            <div>
              <p className="font-serif text-lg font-semibold text-ink">{name || "Your Name"}</p>
              <p className="text-sm text-ink-muted">{user.email}</p>
              <p className="mt-1 text-xs text-ink-muted">Member since {memberSince}</p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream-dark text-ink-muted transition-colors hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream-dark bg-cream">
              <Camera className="h-4 w-4 text-ink-muted" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-ink">Your Profile</h1>
              <p className="text-sm text-ink-muted">Profile</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="form-label">Full Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="form-input"
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="form-label">Email</label>
              <input value={user.email} disabled className="form-input cursor-not-allowed opacity-60" />
            </div>
            <div className="space-y-2">
              <label className="form-label">Age</label>
              <input
                value={age}
                onChange={(event) => setAge(event.target.value)}
                type="number"
                className="form-input"
                placeholder="—"
              />
            </div>
            <div className="space-y-2">
              <label className="form-label">Location</label>
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="form-input"
                placeholder="City, Country"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="form-label">Bio</label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className="form-input h-24 resize-none"
                placeholder="What are you building right now?"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <Link href="/dashboard" className="btn-secondary">
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="btn-primary disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="mb-2 font-serif text-lg font-semibold text-ink">Data & Privacy</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => void handleExport()} className="btn-secondary justify-center">
              <Download className="h-4 w-4" />
              Export Goals
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="btn-secondary justify-center disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import"}
            </button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
          />
          <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/10 px-4 py-4">
            <p className="text-sm font-semibold text-ink">Data Driven!</p>
            <p className="mt-1 text-sm text-ink-muted">
              Your habits are measurable, exportable, and fully yours.
            </p>
          </div>
        </div>

        <div className="card p-6" id="invite">
          <h2 className="mb-2 font-serif text-lg font-semibold text-ink">Grow Your Circle</h2>
          <p className="text-sm text-ink-muted">
            Invite someone by email or phone and they&apos;ll get a link to join your accountability circle.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                className="form-input"
                placeholder="friend@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={invitePhone}
                onChange={(event) => setInvitePhone(event.target.value)}
                className="form-input"
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={inviting || (!inviteEmail && !invitePhone)}
              className="btn-primary disabled:opacity-40"
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/auth/login" })}
              className="rounded-full border border-rose/40 px-5 py-3 text-sm font-medium text-rose transition-all hover:bg-rose/5"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 lg:hidden">
        <section className="panel-shell overflow-hidden">
          <div className="flex items-center justify-between border-b border-cream-dark px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
                Profile
              </p>
              <h1 className="mt-2 text-2xl font-serif font-semibold text-ink">
                Your Profile
              </h1>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cream-dark bg-white/80 text-ink-muted transition-colors hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative">
                <div
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2rem] bg-gold text-2xl font-bold text-ink"
                  title={name || "Your Name"}
                >
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    initials(name)
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cream-dark bg-white shadow-card">
                  <Camera className="h-4 w-4 text-ink-muted" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xl font-serif font-semibold text-ink">
                  {name || "Your Name"}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
                <p className="mt-2 text-xs text-ink-muted">Member since {memberSince}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="form-label">Full Name</label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="form-input min-h-[52px] rounded-2xl"
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="form-label">Email</label>
                <input
                  value={user.email}
                  disabled
                  className="form-input min-h-[52px] rounded-2xl cursor-not-allowed opacity-60"
                />
              </div>
              <div className="space-y-2">
                <label className="form-label">Age</label>
                <input
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  type="number"
                  className="form-input min-h-[52px] rounded-2xl"
                  placeholder="—"
                />
              </div>
              <div className="space-y-2">
                <label className="form-label">Location</label>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className="form-input min-h-[52px] rounded-2xl"
                  placeholder="City, Country"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="form-label">Bio</label>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  className="form-input h-28 resize-none rounded-[1.5rem]"
                  placeholder="What are you building right now?"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link href="/dashboard" className="btn-secondary min-h-[48px] rounded-2xl px-5">
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="btn-primary min-h-[48px] rounded-2xl px-5 disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </section>

        <section className="panel-shell p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Data & Privacy
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="btn-secondary min-h-[48px] justify-center rounded-2xl px-5"
            >
              <Download className="h-4 w-4" />
              Export Goals
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="btn-secondary min-h-[48px] justify-center rounded-2xl px-5 disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importing..." : "Import"}
            </button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
          />

          <div className="mt-4 rounded-[1.5rem] border border-gold/20 bg-gold/10 px-4 py-4">
            <p className="text-sm font-semibold text-ink">Data Driven!</p>
            <p className="mt-1 text-sm text-ink-muted">
              Your habits are measurable, exportable, and fully yours.
            </p>
          </div>
        </section>

        <section className="panel-shell p-5 sm:p-6" id="invite">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Grow Your Circle
          </p>
          <p className="mt-3 text-sm leading-6 text-ink-muted">
            Invite someone by email or phone and they&apos;ll get a link to join your accountability circle.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                className="form-input min-h-[52px] rounded-2xl"
                placeholder="friend@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={invitePhone}
                onChange={(event) => setInvitePhone(event.target.value)}
                className="form-input min-h-[52px] rounded-2xl"
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={inviting || (!inviteEmail && !invitePhone)}
              className="btn-primary min-h-[48px] rounded-2xl px-5 disabled:opacity-40"
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/auth/login" })}
              className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-rose/30 px-5 text-sm font-medium text-rose transition-colors hover:bg-rose/10"
            >
              Sign Out
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
