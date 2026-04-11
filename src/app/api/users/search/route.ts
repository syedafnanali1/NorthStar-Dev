// src/app/api/users/search/route.ts
// GET ?q=searchterm — return top 10 users by name or username

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { getSessionUserId } from "@/lib/auth/helpers";
import { and, ilike, ne, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const pattern = `%${q}%`;

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      image: users.image,
    })
    .from(users)
    .where(
      and(
        ne(users.id, userId),
        or(ilike(users.name, pattern), ilike(users.username, pattern), ilike(users.email, pattern))
      )
    )
    .limit(10);

  return NextResponse.json({ users: results });
}
