// src/app/profile/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireAuthUser();

  return (
    <AppLayout contentClassName="max-w-4xl lg:max-w-[640px]">
      <ProfileForm user={user} />
    </AppLayout>
  );
}
