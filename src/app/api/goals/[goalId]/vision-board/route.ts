export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { visionBoardService } from "@/server/services/vision-board.service";
import type { NextRequest } from "next/server";

const createItemSchema = z.object({
  itemType: z.enum(["image", "quote", "text"]),
  content: z.string().min(1).max(280),
  assetUrl: z.string().url().optional(),
  quoteAuthor: z.string().max(120).optional(),
  x: z.coerce.number().min(0).max(1).optional(),
  y: z.coerce.number().min(0).max(1).optional(),
  width: z.coerce.number().min(0.05).max(1).optional(),
  height: z.coerce.number().min(0.05).max(1).optional(),
  zIndex: z.coerce.number().int().min(0).max(999).optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

interface RouteContext {
  params: Promise<{ goalId: string }>;
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId } = await ctx.params;

  try {
    const board = await visionBoardService.getBoard(goalId, userId);
    return NextResponse.json(board);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch vision board";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId } = await ctx.params;

  try {
    const body: unknown = await request.json();
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const item = await visionBoardService.addItem(goalId, userId, parsed.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add vision board item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

