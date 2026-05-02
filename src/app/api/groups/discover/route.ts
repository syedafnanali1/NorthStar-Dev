export const runtime = "edge";

// src/app/api/groups/discover/route.ts
// GET /api/groups/discover?q=&sort=popularity|newest|members&category=health
// Public group search and browse for the Discovery page.

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupsService } from "@/server/services/groups.service";
import type { NextRequest } from "next/server";
import type { DiscoverSortBy, GroupCategory } from "@/server/services/groups.service";

const VALID_SORTS: DiscoverSortBy[] = ["popularity", "newest", "members"];
const VALID_CATEGORIES: GroupCategory[] = [
  "health", "fitness", "finance", "mindset", "writing",
  "reading", "career", "lifestyle", "creativity", "community", "other",
];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q") ?? "";
  const sortRaw = searchParams.get("sort") ?? "popularity";
  const categoryRaw = searchParams.get("category") ?? "";
  const sort: DiscoverSortBy = VALID_SORTS.includes(sortRaw as DiscoverSortBy)
    ? (sortRaw as DiscoverSortBy)
    : "popularity";
  const category: GroupCategory | undefined = VALID_CATEGORIES.includes(categoryRaw as GroupCategory)
    ? (categoryRaw as GroupCategory)
    : undefined;

  try {
    const groups = await groupsService.searchPublicGroups(userId, query, sort, category);
    return NextResponse.json({ groups });
  } catch (err) {
    console.error("[GET /api/groups/discover]", err);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}
