// src/app/api/users/search/route.ts
// GET ?q=searchterm — return users matching name, username, or email with connection status

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, circleConnections } from "@/drizzle/schema";
import { getSessionUserId } from "@/lib/auth/helpers";
import { and, eq, ilike, ne, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  const pattern = `%${q}%`;

  const [results, allConnections] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
        age: users.age,
        location: users.location,
        jobTitle: users.jobTitle,
        countryRegion: users.countryRegion,
        momentumScore: users.momentumScore,
        currentStreak: users.currentStreak,
        totalGoalsCompleted: users.totalGoalsCompleted,
      })
      .from(users)
      .where(
        and(
          ne(users.id, userId),
          or(ilike(users.name, pattern), ilike(users.username, pattern), ilike(users.email, pattern))
        )
      )
      .limit(20),

    db
      .select({
        id: circleConnections.id,
        requesterId: circleConnections.requesterId,
        receiverId: circleConnections.receiverId,
        status: circleConnections.status,
      })
      .from(circleConnections)
      .where(
        or(
          eq(circleConnections.requesterId, userId),
          eq(circleConnections.receiverId, userId)
        )
      ),
  ]);

  type ConnInfo = { connectionId: string; status: string; direction: "sent" | "received" };
  const connectionMap = new Map<string, ConnInfo>();
  for (const conn of allConnections) {
    const otherId = conn.requesterId === userId ? conn.receiverId : conn.requesterId;
    connectionMap.set(otherId, {
      connectionId: conn.id,
      status: conn.status,
      direction: conn.requesterId === userId ? "sent" : "received",
    });
  }

  const usersWithStatus = results.map((u) => ({
    ...u,
    connection: connectionMap.get(u.id) ?? null,
  }));

  return NextResponse.json({ users: usersWithStatus });
}
