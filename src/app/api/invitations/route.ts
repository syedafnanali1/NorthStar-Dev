// src/app/api/invitations/route.ts
// POST /api/invitations — send an invitation by email or phone

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { invitationsService } from "@/server/services/invitations.service";
import { sendInvitationSchema } from "@/lib/validators/profile";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const validated = sendInvitationSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    await invitationsService.send(userId, validated.data);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/invitations]", err);
    return NextResponse.json({ error: "Failed to send invitation" }, { status: 500 });
  }
}
