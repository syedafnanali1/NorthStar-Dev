export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, or } from "drizzle-orm";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  circleConnections,
  goals,
  sharedGoals,
} from "@/drizzle/schema";
import { invitationsService } from "@/server/services/invitations.service";
import type { NextRequest } from "next/server";

const shareGoalSchema = z
  .object({
    email: z.string().email().optional(),
    selectedUserIds: z.array(z.string()).max(10).optional().default([]),
  })
  .refine((data) => Boolean(data.email) || data.selectedUserIds.length > 0, {
    message: "Select someone or enter an email address.",
  });

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goalId } = await params;

  try {
    const [goal] = await db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const validated = shareGoalSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message ?? "Validation failed" },
        { status: 422 }
      );
    }

    const { email, selectedUserIds } = validated.data;

    if (selectedUserIds.length > 0) {
      const acceptedConnections = await db
        .select({
          requesterId: circleConnections.requesterId,
          receiverId: circleConnections.receiverId,
        })
        .from(circleConnections)
        .where(
          and(
            eq(circleConnections.status, "accepted"),
            or(
              and(
                eq(circleConnections.requesterId, userId),
                inArray(circleConnections.receiverId, selectedUserIds)
              ),
              and(
                eq(circleConnections.receiverId, userId),
                inArray(circleConnections.requesterId, selectedUserIds)
              )
            )
          )
        );

      const allowedIds = acceptedConnections.map((connection) =>
        connection.requesterId === userId
          ? connection.receiverId
          : connection.requesterId
      );

      const shareableIds = selectedUserIds.filter((id) => allowedIds.includes(id));

      if (shareableIds.length > 0) {
        await db
          .insert(sharedGoals)
          .values(
            shareableIds.map((sharedWithUserId) => ({
              goalId,
              sharedWithUserId,
            }))
          )
          .onConflictDoNothing();
      }
    }

    if (email) {
      await invitationsService.send(userId, { email, goalIds: [goalId] });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/goals/:goalId/share]", error);
    return NextResponse.json({ error: "Failed to share goal" }, { status: 500 });
  }
}
