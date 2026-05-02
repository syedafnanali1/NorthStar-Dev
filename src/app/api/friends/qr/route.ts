export const runtime = "edge";

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { friendsService } from "@/server/services/friends.service";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const qr = await friendsService.getOrCreateQrCode(userId);
    return NextResponse.json({ qr });
  } catch (err) {
    console.error("[GET /api/friends/qr]", err);
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
}

