// src/app/goals/[id]/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { goalsService } from "@/server/services/goals.service";
import { notFound } from "next/navigation";
import { GoalDetailView } from "./goal-detail-view";
import { db } from "@/lib/db";
import { circleConnections, sharedGoals, users } from "@/drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Goal Detail" };
}

export default async function GoalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuthUser();
  const goal = await goalsService.getById(id, user.id);
  if (!goal) notFound();

  const [incoming, outgoing, sharedWith] = await Promise.all([
    db
      .select({ otherId: circleConnections.requesterId })
      .from(circleConnections)
      .where(
        and(
          eq(circleConnections.receiverId, user.id),
          eq(circleConnections.status, "accepted")
        )
      ),
    db
      .select({ otherId: circleConnections.receiverId })
      .from(circleConnections)
      .where(
        and(
          eq(circleConnections.requesterId, user.id),
          eq(circleConnections.status, "accepted")
        )
      ),
    db
      .select({ userId: sharedGoals.sharedWithUserId })
      .from(sharedGoals)
      .where(eq(sharedGoals.goalId, goal.id)),
  ]);

  const connectionIds = [
    ...incoming.map((connection) => connection.otherId),
    ...outgoing.map((connection) => connection.otherId),
  ];

  const circleMembers =
    connectionIds.length > 0
      ? await db
          .select({
            id: users.id,
            name: users.name,
            image: users.image,
            streak: users.currentStreak,
          })
          .from(users)
          .where(inArray(users.id, connectionIds))
      : [];

  return (
    <AppLayout contentClassName="max-w-5xl lg:max-w-5xl">
      <GoalDetailView
        goal={goal}
        currentUserId={user.id}
        circleMembers={circleMembers}
        sharedMemberIds={sharedWith.map((member) => member.userId)}
      />
    </AppLayout>
  );
}
