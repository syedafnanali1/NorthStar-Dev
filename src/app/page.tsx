// src/app/page.tsx
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/helpers";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const userId = await getSessionUserId();
  redirect(userId ? "/dashboard" : "/auth/login");
}
