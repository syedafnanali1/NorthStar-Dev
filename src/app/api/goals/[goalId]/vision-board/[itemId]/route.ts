export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { visionBoardService } from "@/server/services/vision-board.service";
import type { NextRequest } from "next/server";

const patchSchema = z.object({
  content: z.string().min(1).max(280).optional(),
  assetUrl: z.string().url().nullable().optional(),
  quoteAuthor: z.string().max(120).nullable().optional(),
  x: z.coerce.number().min(0).max(1).optional(),
  y: z.coerce.number().min(0).max(1).optional(),
  width: z.coerce.number().min(0.05).max(1).optional(),
  height: z.coerce.number().min(0.05).max(1).optional(),
  zIndex: z.coerce.number().int().min(0).max(999).optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

interface RouteContext {
  params: Promise<{ goalId: string; itemId: string }>;
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId, itemId } = await ctx.params;

  try {
    const body: unknown = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const item = await visionBoardService.updateItem(goalId, itemId, userId, parsed.data);
    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update vision board item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId, itemId } = await ctx.params;

  try {
    await visionBoardService.deleteItem(goalId, itemId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete vision board item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

