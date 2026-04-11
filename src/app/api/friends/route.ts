import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { friendsService } from "@/server/services/friends.service";
import type { NextRequest } from "next/server";

const sendFriendRequestSchema = z
  .object({
    username: z.string().min(2).max(40).optional(),
    email: z.string().email().optional(),
    qrCode: z.string().min(8).max(64).optional(),
  })
  .refine((value) => Boolean(value.username || value.email || value.qrCode), {
    message: "username, email, or qrCode is required",
  });

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const friends = await friendsService.getFriends(userId);
    return NextResponse.json({ friends });
  } catch (err) {
    console.error("[GET /api/friends]", err);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const parsed = sendFriendRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const result = await friendsService.sendFriendRequest(userId, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send friend request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

