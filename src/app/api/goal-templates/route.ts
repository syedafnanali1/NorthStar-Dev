import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { templatesService } from "@/server/services/templates.service";
import type { NextRequest } from "next/server";

const categoryEnum = z.enum([
  "health",
  "finance",
  "writing",
  "body",
  "mindset",
  "custom",
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categoriesParam = request.nextUrl.searchParams.get("categories");
  const categoriesRaw = categoriesParam
    ? categoriesParam
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const parsedCategories = z.array(categoryEnum).safeParse(categoriesRaw);
  if (!parsedCategories.success) {
    return NextResponse.json({ error: "Invalid categories filter" }, { status: 422 });
  }

  try {
    const templates = await templatesService.listTemplates({
      categories: parsedCategories.data,
      limit: 12,
    });

    // Return a curated slice for onboarding/new-goal wizard.
    return NextResponse.json({ templates: templates.slice(0, 6) });
  } catch (err) {
    console.error("[GET /api/goal-templates]", err);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

