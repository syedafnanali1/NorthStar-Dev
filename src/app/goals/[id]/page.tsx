// src/app/goals/[id]/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { goalsService } from "@/server/services/goals.service";
import { notFound } from "next/navigation";
import { GoalDetailView } from "./goal-detail-view";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return { title: "Goal Detail" };
}

export default async function GoalDetailPage({ params }: PageProps) {
  const user = await requireAuthUser();
  const goal = await goalsService.getById(params.id, user.id);
  if (!goal) notFound();

  return (
    <AppLayout>
      <GoalDetailView goal={goal} />
    </AppLayout>
  );
}
