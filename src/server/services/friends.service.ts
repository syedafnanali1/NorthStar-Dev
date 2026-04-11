import { addDays } from "date-fns";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  circleConnections,
  friendQrCodes,
  users,
} from "@/drizzle/schema";
import { notificationsService } from "./notifications.service";
import { xpService } from "./xp.service";

export interface FriendListItem {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  image: string | null;
  level: number;
  xpPoints: number;
  northStarScore: number;
  currentStreak: number;
  momentumScore: number;
}

export interface PendingFriendRequest {
  connectionId: string;
  direction: "incoming" | "outgoing";
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    email: string;
    image: string | null;
  };
}

function makeFindWhere(input: {
  username?: string;
  email?: string;
  qrCode?: string;
}) {
  if (input.username) {
    return eq(users.username, input.username.toLowerCase());
  }
  if (input.email) {
    return sql`lower(${users.email}) = ${input.email.toLowerCase()}`;
  }
  return null;
}

export const friendsService = {
  async getFriends(userId: string): Promise<FriendListItem[]> {
    const rows = await db
      .select({
        requesterId: circleConnections.requesterId,
        receiverId: circleConnections.receiverId,
      })
      .from(circleConnections)
      .where(
        and(
          eq(circleConnections.status, "accepted"),
          or(
            eq(circleConnections.requesterId, userId),
            eq(circleConnections.receiverId, userId)
          )
        )
      );

    const friendIds = [
      ...new Set(
        rows.map((row) => (row.requesterId === userId ? row.receiverId : row.requesterId))
      ),
    ];
    if (friendIds.length === 0) return [];

    return db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        image: users.image,
        level: users.level,
        xpPoints: users.xpPoints,
        northStarScore: users.northStarScore,
        currentStreak: users.currentStreak,
        momentumScore: users.momentumScore,
      })
      .from(users)
      .where(inArray(users.id, friendIds))
      .orderBy(desc(users.northStarScore), desc(users.level));
  },

  async getPendingRequests(userId: string): Promise<PendingFriendRequest[]> {
    const [incoming, outgoing] = await Promise.all([
      db
        .select({
          connectionId: circleConnections.id,
          createdAt: circleConnections.createdAt,
          user: {
            id: users.id,
            name: users.name,
            username: users.username,
            email: users.email,
            image: users.image,
          },
        })
        .from(circleConnections)
        .innerJoin(users, eq(circleConnections.requesterId, users.id))
        .where(
          and(
            eq(circleConnections.receiverId, userId),
            eq(circleConnections.status, "pending")
          )
        )
        .orderBy(desc(circleConnections.createdAt)),
      db
        .select({
          connectionId: circleConnections.id,
          createdAt: circleConnections.createdAt,
          user: {
            id: users.id,
            name: users.name,
            username: users.username,
            email: users.email,
            image: users.image,
          },
        })
        .from(circleConnections)
        .innerJoin(users, eq(circleConnections.receiverId, users.id))
        .where(
          and(
            eq(circleConnections.requesterId, userId),
            eq(circleConnections.status, "pending")
          )
        )
        .orderBy(desc(circleConnections.createdAt)),
    ]);

    return [
      ...incoming.map((row) => ({ ...row, direction: "incoming" as const })),
      ...outgoing.map((row) => ({ ...row, direction: "outgoing" as const })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getOrCreateQrCode(userId: string): Promise<{ code: string; expiresAt: Date; url: string }> {
    const now = new Date();
    const [existing] = await db
      .select({
        code: friendQrCodes.code,
        expiresAt: friendQrCodes.expiresAt,
      })
      .from(friendQrCodes)
      .where(
        and(
          eq(friendQrCodes.userId, userId),
          sql`${friendQrCodes.expiresAt} > ${now}`
        )
      )
      .orderBy(desc(friendQrCodes.createdAt))
      .limit(1);

    if (existing) {
      return {
        code: existing.code,
        expiresAt: existing.expiresAt,
        url: `${process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"}/circle?qr=${existing.code}`,
      };
    }

    const [created] = await db
      .insert(friendQrCodes)
      .values({
        userId,
        expiresAt: addDays(now, 14),
      })
      .returning({
        code: friendQrCodes.code,
        expiresAt: friendQrCodes.expiresAt,
      });

    if (!created) throw new Error("Failed to generate friend QR code");

    return {
      code: created.code,
      expiresAt: created.expiresAt,
      url: `${process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"}/circle?qr=${created.code}`,
    };
  },

  async sendFriendRequest(
    userId: string,
    input: { username?: string; email?: string; qrCode?: string }
  ): Promise<{ status: "request_sent" | "pending" | "accepted" | "already_friends"; targetId: string }> {
    const now = new Date();
    let targetUser:
      | {
          id: string;
          name: string | null;
          username: string | null;
          email: string;
        }
      | undefined;

    if (input.qrCode) {
      const [qrOwner] = await db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          email: users.email,
        })
        .from(friendQrCodes)
        .innerJoin(users, eq(friendQrCodes.userId, users.id))
        .where(
          and(
            eq(friendQrCodes.code, input.qrCode),
            sql`${friendQrCodes.expiresAt} > ${now}`
          )
        )
        .limit(1);
      targetUser = qrOwner;
    } else {
      const where = makeFindWhere(input);
      if (!where) throw new Error("username, email, or qrCode is required");
      [targetUser] = await db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          email: users.email,
        })
        .from(users)
        .where(where)
        .limit(1);
    }

    if (!targetUser) throw new Error("User not found");
    if (targetUser.id === userId) throw new Error("You cannot add yourself");

    const [existing] = await db
      .select()
      .from(circleConnections)
      .where(
        or(
          and(
            eq(circleConnections.requesterId, userId),
            eq(circleConnections.receiverId, targetUser.id)
          ),
          and(
            eq(circleConnections.requesterId, targetUser.id),
            eq(circleConnections.receiverId, userId)
          )
        )
      )
      .limit(1);

    if (existing?.status === "accepted") {
      return { status: "already_friends", targetId: targetUser.id };
    }

    if (existing?.status === "pending") {
      if (existing.requesterId === userId) {
        return { status: "pending", targetId: targetUser.id };
      }
      await db
        .update(circleConnections)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(circleConnections.id, existing.id));

      await notificationsService.createNotification(
        targetUser.id,
        "friend_activity",
        "Friend request accepted",
        "You are now connected.",
        "/circle"
      );
      return { status: "accepted", targetId: targetUser.id };
    }

    await db.insert(circleConnections).values({
      requesterId: userId,
      receiverId: targetUser.id,
      status: "pending",
    });

    void xpService.awardXP(userId, "invite_friend");

    const [sender] = await db
      .select({ name: users.name, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const senderName = sender?.name ?? (sender?.username ? `@${sender.username}` : "Someone");

    await notificationsService.createNotification(
      targetUser.id,
      "friend_activity",
      "New friend request",
      `${senderName} wants to connect with you.`,
      "/circle"
    );

    return { status: "request_sent", targetId: targetUser.id };
  },

  async respondToRequest(
    userId: string,
    connectionId: string,
    action: "accept" | "decline"
  ): Promise<void> {
    const [request] = await db
      .select()
      .from(circleConnections)
      .where(
        and(
          eq(circleConnections.id, connectionId),
          eq(circleConnections.receiverId, userId),
          eq(circleConnections.status, "pending")
        )
      )
      .limit(1);

    if (!request) throw new Error("Pending request not found");

    if (action === "accept") {
      await db
        .update(circleConnections)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(circleConnections.id, request.id));

      await notificationsService.createNotification(
        request.requesterId,
        "friend_activity",
        "Friend request accepted",
        "You are now connected.",
        "/circle"
      );
      return;
    }

    await db.delete(circleConnections).where(eq(circleConnections.id, request.id));
  },
};
