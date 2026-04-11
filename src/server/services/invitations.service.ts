// src/server/services/invitations.service.ts
// Handles friend invitations via email and SMS

import { addDays } from "date-fns";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { circleConnections, invitations, sharedGoals, users } from "@/drizzle/schema";
import { emailService } from "@/lib/email";
import { smsService } from "@/lib/sms";
import type { SendInvitationInput } from "@/lib/validators/profile";
import { notificationsService } from "./notifications.service";
import { xpService } from "./xp.service";

async function ensureConnection(senderId: string, receiverId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(circleConnections)
    .where(
      or(
        and(
          eq(circleConnections.requesterId, senderId),
          eq(circleConnections.receiverId, receiverId)
        ),
        and(
          eq(circleConnections.requesterId, receiverId),
          eq(circleConnections.receiverId, senderId)
        )
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(circleConnections).values({
      requesterId: senderId,
      receiverId,
      status: "pending",
    });
    return;
  }

  if (existing.status === "accepted") return;

  if (existing.status === "pending" && existing.requesterId === receiverId) {
    await db
      .update(circleConnections)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(circleConnections.id, existing.id));
  }
}

export const invitationsService = {
  /**
   * Send an invitation by email and/or phone
   */
  async send(senderId: string, input: SendInvitationInput): Promise<void> {
    const sender = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, senderId))
      .limit(1)
      .then((r) => r[0]);

    if (!sender) throw new Error("Sender not found");

    // Existing account path: convert to friend request/connection
    if (input.email) {
      const normalizedEmail = input.email.toLowerCase();
      if (normalizedEmail === sender.email.toLowerCase()) {
        throw new Error("You cannot invite yourself");
      }

      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
        .limit(1)
        .then((r) => r[0]);

      if (existingUser) {
        await ensureConnection(senderId, existingUser.id);

        await notificationsService.createNotification(
          existingUser.id,
          "friend_activity",
          "New friend invite",
          `${sender.name ?? "Someone"} invited you to connect.`,
          "/circle"
        );

        void xpService.awardXP(senderId, "invite_friend");
        return;
      }
    }

    // Avoid duplicate active invites for same sender+target
    const [pendingInvite] = await db
      .select({ id: invitations.id, expiresAt: invitations.expiresAt })
      .from(invitations)
      .where(
        and(
          eq(invitations.senderId, senderId),
          eq(invitations.status, "pending"),
          input.email ? eq(invitations.inviteeEmail, input.email) : sql`true`,
          input.phone ? eq(invitations.inviteePhone, input.phone) : sql`true`
        )
      )
      .orderBy(desc(invitations.createdAt))
      .limit(1);

    if (pendingInvite && pendingInvite.expiresAt > new Date()) {
      return;
    }

    // Create invitation record
    const [invitation] = await db
      .insert(invitations)
      .values({
        senderId,
        inviteeEmail: input.email,
        inviteePhone: input.phone,
        goalIds: input.goalIds ?? [],
        expiresAt: addDays(new Date(), 7),
      })
      .returning();

    if (!invitation) throw new Error("Failed to create invitation");

    const inviteUrl = `${process.env["NEXT_PUBLIC_APP_URL"]}/auth/register?invite=${invitation.token}`;
    const senderName = sender.name ?? "Someone";

    // Send email if provided
    if (input.email) {
      await emailService.sendInvitation({
        to: input.email,
        senderName,
        inviteUrl,
      });
    }

    // Send SMS if provided
    if (input.phone) {
      await smsService.sendInvitation({
        to: input.phone,
        senderName,
        inviteUrl,
      });
    }

    void xpService.awardXP(senderId, "invite_friend");
  },

  /**
   * Accept an invitation using a token
   */
  async accept(token: string, newUserId: string): Promise<void> {
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    if (!invitation) throw new Error("Invitation not found");
    if (invitation.expiresAt < new Date()) throw new Error("Invitation has expired");
    if (invitation.status !== "pending") throw new Error("Invitation already used");

    await ensureConnection(invitation.senderId, newUserId);

    if (invitation.goalIds.length > 0) {
      await db
        .insert(sharedGoals)
        .values(
          invitation.goalIds.map((goalId) => ({
            goalId,
            sharedWithUserId: newUserId,
          }))
        )
        .onConflictDoNothing();
    }

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ status: "accepted" })
      .where(eq(invitations.id, invitation.id));
  },
};

