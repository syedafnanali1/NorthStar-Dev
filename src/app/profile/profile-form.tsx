// src/app/profile/profile-form.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { initials, cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import type { User } from "@/drizzle/schema";

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [age, setAge] = useState(user.age?.toString() ?? "");
  const [location, setLocation] = useState(user.location ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviting, setInviting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          age: age ? parseInt(age) : undefined,
          location: location || undefined,
          bio: bio || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Profile saved ✓");
      router.refresh();
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail && !invitePhone) return;
    setInviting(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail || undefined,
          phone: invitePhone || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Invitation sent! 🛸");
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
      const res = await fetch("/api/goals");
      const data = await res.json() as { goals: unknown[] };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `northstar-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Data exported ✓");
    } catch {
      toast("Export failed", "error");
    }
  };

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-ink overflow-hidden flex-shrink-0"
          style={{ background: "#C4963A" }}
        >
          {user.image
            ? <img src={user.image} alt={name} className="w-full h-full object-cover" />
            : initials(name)}
        </div>
        <div>
          <p className="font-serif font-semibold text-ink text-lg">{name || "Your Name"}</p>
          <p className="text-sm text-ink-muted">{user.email}</p>
          <p className="text-xs text-ink-muted mt-1">
            Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Profile fields */}
      <div className="card p-6 space-y-4">
        <h2 className="font-serif font-semibold text-ink text-lg mb-2">Personal Info</h2>

        <div>
          <label className="form-label">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="form-input" placeholder="Your name" />
        </div>
        <div>
          <label className="form-label">Email</label>
          <input value={user.email} disabled className="form-input opacity-50 cursor-not-allowed" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Age</label>
            <input value={age} onChange={(e) => setAge(e.target.value)} type="number" className="form-input" placeholder="—" />
          </div>
          <div>
            <label className="form-label">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="form-input" placeholder="City, Country" />
          </div>
        </div>
        <div>
          <label className="form-label">Bio (optional)</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="form-input resize-none h-20" placeholder="A few words about you..." />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? "Saving..." : "Save Profile ✓"}
        </button>
      </div>

      {/* Invite section */}
      <div className="card p-6 space-y-4" id="invite">
        <h2 className="font-serif font-semibold text-ink text-lg mb-2">Invite a Friend 🛸</h2>
        <p className="text-sm text-ink-muted">
          They&apos;ll get both an email and a text with a unique sign-up link.
          If they already have an account, they&apos;ll get a connection request.
        </p>
        <div>
          <label className="form-label">Email Address</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="form-input"
            placeholder="friend@example.com"
          />
        </div>
        <div>
          <label className="form-label">Or Phone Number</label>
          <input
            type="tel"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            className="form-input"
            placeholder="+1 555 000 0000"
          />
        </div>
        <button
          onClick={handleInvite}
          disabled={inviting || (!inviteEmail && !invitePhone)}
          className="btn-primary w-full disabled:opacity-40"
        >
          {inviting ? "Sending..." : "Send Invite →"}
        </button>
      </div>

      {/* Data & Privacy */}
      <div className="card p-6 space-y-3">
        <h2 className="font-serif font-semibold text-ink text-lg mb-2">Data & Privacy</h2>
        <button onClick={handleExport} className="btn-secondary w-full">
          📤 Export Goals (JSON)
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="w-full py-3 px-4 rounded-full border-[1.5px] border-rose/40 text-rose text-sm font-medium hover:bg-rose/5 transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
