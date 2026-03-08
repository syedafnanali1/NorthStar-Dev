// src/app/profile/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireAuthUser();

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <p className="text-2xs uppercase tracking-widest text-ink-muted mb-1">Account</p>
          <h1 className="text-3xl font-serif text-ink">Your Profile</h1>
        </div>
        <ProfileForm user={user} />
      </div>
    </AppLayout>
  );
}
