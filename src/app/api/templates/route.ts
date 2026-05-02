export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { templatesService } from "@/server/services/templates.service";
import type { NextRequest } from "next/server";

const categorySchema = z.enum([
  "health",
  "finance",
  "writing",
  "body",
  "mindset",
  "custom",
]);

const listQuerySchema = z.object({
  categories: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : []
    ),
  includePending: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

const submitSchema = z.object({
  title: z.string().min(3).max(140),
  category: categorySchema,
  emoji: z.string().min(1).max(8),
  description: z.string().min(10).max(600),
  targetValue: z.coerce.number().positive().optional().nullable(),
  unit: z.string().max(30).optional().nullable(),
  suggestedMilestones: z.array(z.string().min(1).max(120)).max(10).optional().default([]),
  suggestedTasks: z.array(z.string().min(1).max(140)).max(10).optional().default([]),
  motivationalPrompts: z.array(z.string().min(1).max(180)).max(10).optional().default([]),
  timeframeDays: z.coerce.number().int().positive().max(2000).optional().nullable(),
  defaultWhy: z.string().max(400).optional().nullable(),
  defaultTasks: z.array(z.string().min(1).max(140)).max(10).optional().default([]),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedQuery = listQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedQuery.error.flatten() },
      { status: 422 }
    );
  }

  const categoryResults = z.array(categorySchema).safeParse(parsedQuery.data.categories);
  if (!categoryResults.success) {
    return NextResponse.json({ error: "Invalid categories filter" }, { status: 422 });
  }

  try {
    const templates = await templatesService.listTemplates({
      categories: categoryResults.data,
      includePendingForUserId: parsedQuery.data.includePending ? userId : undefined,
      limit: parsedQuery.data.limit,
    });
    return NextResponse.json({
      templates,
      total: templates.length,
      hasOfficialLibrary: templatesService.getDefaultTemplates().length >= 50,
    });
  } catch (err) {
    console.error("[GET /api/templates]", err);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const template = await templatesService.submitCommunityTemplate(userId, parsed.data);
    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit template";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

