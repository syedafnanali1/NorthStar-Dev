import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { goalVisionBoardItems, goals } from "@/drizzle/schema";

const generatedVisionSchema = z.object({
  items: z
    .array(
      z.object({
        itemType: z.enum(["image", "quote", "text"]),
        content: z.string().min(1).max(280),
        assetUrl: z.string().url().optional().nullable(),
        quoteAuthor: z.string().max(120).optional().nullable(),
      })
    )
    .min(3)
    .max(8),
  focusPrompt: z.string().min(10).max(300),
});

function normalizeUrlFromContent(content: string): string {
  const query = encodeURIComponent(content.split(" ").slice(0, 6).join(" "));
  return `https://source.unsplash.com/featured/800x600/?${query}`;
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey || apiKey === "sk-ant-your-key-here") return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return data.content.find((item) => item.type === "text")?.text ?? null;
  } catch {
    return null;
  }
}

function parseGeneratedPayload(raw: string | null): z.infer<typeof generatedVisionSchema> | null {
  if (!raw) return null;
  try {
    const stripped = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const json = JSON.parse(stripped);
    return generatedVisionSchema.parse(json);
  } catch {
    return null;
  }
}

export const visionBoardService = {
  async getBoard(goalId: string, userId: string) {
    const [goal] = await db
      .select({
        id: goals.id,
        title: goals.title,
        why: goals.why,
        category: goals.category,
      })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");

    const items = await db
      .select()
      .from(goalVisionBoardItems)
      .where(
        and(
          eq(goalVisionBoardItems.goalId, goalId),
          eq(goalVisionBoardItems.userId, userId)
        )
      )
      .orderBy(asc(goalVisionBoardItems.zIndex), asc(goalVisionBoardItems.createdAt));

    return { goal, items };
  },

  async addItem(
    goalId: string,
    userId: string,
    input: {
      itemType: "image" | "quote" | "text";
      content: string;
      assetUrl?: string;
      quoteAuthor?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      zIndex?: number;
      style?: Record<string, unknown>;
    }
  ) {
    await this.getBoard(goalId, userId);
    const [item] = await db
      .insert(goalVisionBoardItems)
      .values({
        goalId,
        userId,
        itemType: input.itemType,
        content: input.content,
        assetUrl: input.assetUrl ?? null,
        quoteAuthor: input.quoteAuthor ?? null,
        x: input.x ?? 0.5,
        y: input.y ?? 0.5,
        width: input.width ?? 0.3,
        height: input.height ?? 0.2,
        zIndex: input.zIndex ?? 0,
        style: input.style ?? {},
      })
      .returning();

    if (!item) throw new Error("Failed to add vision board item");
    return item;
  },

  async updateItem(
    goalId: string,
    itemId: string,
    userId: string,
    patch: Partial<{
      content: string;
      assetUrl: string | null;
      quoteAuthor: string | null;
      x: number;
      y: number;
      width: number;
      height: number;
      zIndex: number;
      style: Record<string, unknown>;
    }>
  ) {
    await this.getBoard(goalId, userId);
    const [updated] = await db
      .update(goalVisionBoardItems)
      .set({
        ...(patch.content !== undefined && { content: patch.content }),
        ...(patch.assetUrl !== undefined && { assetUrl: patch.assetUrl }),
        ...(patch.quoteAuthor !== undefined && { quoteAuthor: patch.quoteAuthor }),
        ...(patch.x !== undefined && { x: patch.x }),
        ...(patch.y !== undefined && { y: patch.y }),
        ...(patch.width !== undefined && { width: patch.width }),
        ...(patch.height !== undefined && { height: patch.height }),
        ...(patch.zIndex !== undefined && { zIndex: patch.zIndex }),
        ...(patch.style !== undefined && { style: patch.style }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(goalVisionBoardItems.id, itemId),
          eq(goalVisionBoardItems.goalId, goalId),
          eq(goalVisionBoardItems.userId, userId)
        )
      )
      .returning();

    if (!updated) throw new Error("Vision board item not found");
    return updated;
  },

  async deleteItem(goalId: string, itemId: string, userId: string): Promise<void> {
    await db
      .delete(goalVisionBoardItems)
      .where(
        and(
          eq(goalVisionBoardItems.id, itemId),
          eq(goalVisionBoardItems.goalId, goalId),
          eq(goalVisionBoardItems.userId, userId)
        )
      );
  },

  async generateFromDescription(
    goalId: string,
    userId: string,
    description: string
  ): Promise<{ focusPrompt: string }> {
    const board = await this.getBoard(goalId, userId);

    const systemPrompt = [
      "You are a vision-board strategist.",
      "Return JSON only with keys: items, focusPrompt.",
      "items must be 3-6 objects with itemType (image|quote|text), content, optional assetUrl, optional quoteAuthor.",
      "focusPrompt should be a short daily visualization script.",
    ].join("\n");

    const userPrompt = [
      `Goal: ${board.goal.title}`,
      `Why: ${board.goal.why ?? "not provided"}`,
      `Description: ${description}`,
    ].join("\n");

    const generated = parseGeneratedPayload(await callClaude(systemPrompt, userPrompt));
    const fallbackItems: z.infer<typeof generatedVisionSchema>["items"] = [
      {
        itemType: "image" as const,
        content: board.goal.title,
        assetUrl: normalizeUrlFromContent(board.goal.title),
      },
      {
        itemType: "quote" as const,
        content: board.goal.why
          ? `I keep going because ${board.goal.why}.`
          : "Consistency compounds into identity.",
      },
      {
        itemType: "text" as const,
        content: "One focused action today moves me closer.",
      },
    ];

    const payload: z.infer<typeof generatedVisionSchema> = generated ?? {
      items: fallbackItems,
      focusPrompt: `Picture yourself completing "${board.goal.title}" and taking one decisive action today.`,
    };

    await db
      .delete(goalVisionBoardItems)
      .where(
        and(
          eq(goalVisionBoardItems.goalId, goalId),
          eq(goalVisionBoardItems.userId, userId)
        )
      );

    await db.insert(goalVisionBoardItems).values(
      payload.items.map((item, index) => ({
        goalId,
        userId,
        itemType: item.itemType,
        content: item.content,
        assetUrl:
          item.itemType === "image"
            ? item.assetUrl ?? normalizeUrlFromContent(item.content)
            : item.assetUrl ?? null,
        quoteAuthor: item.quoteAuthor ?? null,
        x: (index % 3) * 0.28 + 0.18,
        y: Math.floor(index / 3) * 0.28 + 0.2,
        width: item.itemType === "image" ? 0.34 : 0.28,
        height: item.itemType === "image" ? 0.26 : 0.2,
        zIndex: index,
        style: {},
      }))
    );

    return { focusPrompt: payload.focusPrompt };
  },

  async getFocusPayload(goalId: string, userId: string) {
    const { goal, items } = await this.getBoard(goalId, userId);
    const script = `Breathe. Visualize ${goal.title}. ${
      goal.why ? `Remember: ${goal.why}. ` : ""
    }Pick one action you can finish today, then log it immediately.`;
    return {
      goal,
      items,
      script,
      generatedAt: new Date().toISOString(),
    };
  },
};
