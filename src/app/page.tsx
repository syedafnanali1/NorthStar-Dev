// src/app/page.tsx
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/helpers";

export default async function RootPage() {
  const userId = await getSessionUserId();
  redirect(userId ? "/dashboard" : "/auth/login");
}
