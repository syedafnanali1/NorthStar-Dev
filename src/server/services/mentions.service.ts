import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { circleConnections, users } from "@/drizzle/schema";
import { notificationsService } from "./notifications.service";

const MENTION_RE = /(?:^|\s)@([a-zA-Z0-9_.]{2,32})/g;

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function extractMentions(text: string): string[] {
  const hits: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(text)) !== null) {
    const username = match[1]?.toLowerCase();
    if (username) hits.push(username);
  }
  return [...new Set(hits)].slice(0, 8);
}

async function getAcceptedFriendIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      requesterId: circleConnections.requesterId,
      receiverId: circleConnections.receiverId,
    })
    .from(circleConnections)
    .where(
      and(
        eq(circleConnections.status, "accepted"),
        or(
          eq(circleConnections.requesterId, userId),
          eq(circleConnections.receiverId, userId)
        )
      )
    );

  const ids = rows.map((row) =>
    row.requesterId === userId ? row.receiverId : row.requesterId
  );
  return new Set(ids);
}

export const mentionsService = {
  async notifyMentionedUsers(input: {
    actorUserId: string;
    text: string;
    link: string;
    contextLabel?: string;
  }): Promise<{ notified: number; usernames: string[] }> {
    const usernames = extractMentions(input.text);
    if (usernames.length === 0) return { notified: 0, usernames: [] };

    const [targets, actor, friendSet] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
        })
        .from(users)
        .where(inArray(users.username, usernames)),
      db
        .select({
          name: users.name,
          username: users.username,
        })
        .from(users)
        .where(eq(users.id, input.actorUserId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      getAcceptedFriendIds(input.actorUserId),
    ]);

    const actorLabel =
      actor?.name ?? (actor?.username ? `@${actor.username}` : "A friend");
    const body = compact(input.text).slice(0, 140);

    let notified = 0;
    for (const target of targets) {
      if (!target.id || target.id === input.actorUserId) continue;
      if (!friendSet.has(target.id)) continue;
      await notificationsService.createNotification(
        target.id,
        "comment",
        input.contextLabel ? `Mentioned in ${input.contextLabel}` : "You were mentioned",
        `${actorLabel} mentioned you: ${body}`,
        input.link
      );
      notified += 1;
    }

    return { notified, usernames };
  },
};

