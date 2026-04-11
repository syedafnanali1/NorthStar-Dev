import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { naturalLogService } from "@/server/services/natural-log.service";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  text: z.string().max(1000).optional(),
  transcript: z.string().max(2000).optional(),
  autoApply: z.boolean().optional().default(false),
  goalId: z.string().optional(),
  value: z.number().positive().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const inputText = parsed.data.text ?? parsed.data.transcript ?? "";
    const parsedLog = await naturalLogService.parseForUser(userId, inputText);

    if (!parsed.data.autoApply) {
      return NextResponse.json({ parsed: parsedLog });
    }

    const goalId = parsed.data.goalId ?? parsedLog.suggestion?.goalId;
    const value = parsed.data.value ?? parsedLog.suggestion?.value;
    if (!goalId || !value) {
      return NextResponse.json(
        { error: "Could not determine goal/value to auto-apply.", parsed: parsedLog },
        { status: 400 }
      );
    }

    const applied = await naturalLogService.applyParsedLog({
      userId,
      goalId,
      value,
      note: parsedLog.note,
    });

    return NextResponse.json({ parsed: parsedLog, applied });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process log";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

