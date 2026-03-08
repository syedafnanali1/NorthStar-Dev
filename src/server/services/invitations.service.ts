// src/server/services/invitations.service.ts
// Handles friend invitations via email and SMS

import { db } from "@/lib/db";
import { invitations, users, circleConnections } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { addDays } from "date-fns";
import { emailService } from "@/lib/email";
import { smsService } from "@/lib/sms";
import type { SendInvitationInput } from "@/lib/validators/profile";

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

    // Check if the target user already exists
    let existingUser = null;
    if (input.email) {
      existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1)
        .then((r) => r[0]);
    }

    if (existingUser) {
      // User exists — send a connection request instead
      const [existingConnection] = await db
        .select()
        .from(circleConnections)
        .where(
          and(
            eq(circleConnections.requesterId, senderId),
            eq(circleConnections.receiverId, existingUser.id)
          )
        )
        .limit(1);

      if (!existingConnection) {
        await db.insert(circleConnections).values({
          requesterId: senderId,
          receiverId: existingUser.id,
          status: "pending",
        });
      }
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

    // Create connection
    await db.insert(circleConnections).values({
      requesterId: invitation.senderId,
      receiverId: newUserId,
      status: "accepted",
    });

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ status: "accepted" })
      .where(eq(invitations.id, invitation.id));
  },
};
