import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, teamWorkspaceMembers, teamWorkspaces, users } from "@/drizzle/schema";
import { subscriptionsService } from "./subscriptions.service";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

export const teamsService = {
  async getWorkspacesForUser(userId: string) {
    return db
      .select({
        team: teamWorkspaces,
        membershipRole: teamWorkspaceMembers.role,
      })
      .from(teamWorkspaceMembers)
      .innerJoin(teamWorkspaces, eq(teamWorkspaceMembers.teamId, teamWorkspaces.id))
      .where(eq(teamWorkspaceMembers.userId, userId));
  },

  async createWorkspace(ownerUserId: string, name: string) {
    if (!(await subscriptionsService.hasActiveTeamPlan(ownerUserId))) {
      throw new Error("Active Teams plan required to create a workspace.");
    }

    const baseSlug = slugify(name) || "team";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    const [team] = await db
      .insert(teamWorkspaces)
      .values({
        name: name.trim(),
        slug,
        ownerUserId,
        updatedAt: new Date(),
      })
      .returning();
    if (!team) throw new Error("Failed to create workspace.");

    await db.insert(teamWorkspaceMembers).values({
      teamId: team.id,
      userId: ownerUserId,
      role: "admin",
    });

    return team;
  },

  async listMembers(teamId: string, viewerUserId: string) {
    const [membership] = await db
      .select({ id: teamWorkspaceMembers.id })
      .from(teamWorkspaceMembers)
      .where(
        and(
          eq(teamWorkspaceMembers.teamId, teamId),
          eq(teamWorkspaceMembers.userId, viewerUserId)
        )
      )
      .limit(1);
    if (!membership) throw new Error("Not a member of this workspace.");

    return db
      .select({
        role: teamWorkspaceMembers.role,
        joinedAt: teamWorkspaceMembers.joinedAt,
        user: {
          id: users.id,
          name: users.name,
          username: users.username,
          email: users.email,
          image: users.image,
          level: users.level,
          northStarScore: users.northStarScore,
        },
      })
      .from(teamWorkspaceMembers)
      .innerJoin(users, eq(teamWorkspaceMembers.userId, users.id))
      .where(eq(teamWorkspaceMembers.teamId, teamId));
  },

  async addMember(input: {
    teamId: string;
    actorUserId: string;
    targetUserId?: string;
    username?: string;
    email?: string;
    role?: "member" | "admin";
  }) {
    const [actorMembership] = await db
      .select({ role: teamWorkspaceMembers.role })
      .from(teamWorkspaceMembers)
      .where(
        and(
          eq(teamWorkspaceMembers.teamId, input.teamId),
          eq(teamWorkspaceMembers.userId, input.actorUserId)
        )
      )
      .limit(1);

    if (!actorMembership || actorMembership.role !== "admin") {
      throw new Error("Only workspace admins can add members.");
    }

    let targetId = input.targetUserId;
    if (!targetId) {
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          or(
            input.username ? eq(users.username, input.username.toLowerCase()) : sql`false`,
            input.email ? eq(users.email, input.email.toLowerCase()) : sql`false`
          )
        )
        .limit(1);
      targetId = target?.id;
    }

    if (!targetId) throw new Error("Target user not found.");

    const [member] = await db
      .insert(teamWorkspaceMembers)
      .values({
        teamId: input.teamId,
        userId: targetId,
        role: input.role ?? "member",
      })
      .onConflictDoNothing()
      .returning();

    return member ?? { teamId: input.teamId, userId: targetId, role: input.role ?? "member" };
  },

  async getTeamDashboard(teamId: string, userId: string) {
    const members = await this.listMembers(teamId, userId);
    const memberIds = members.map((m) => m.user.id);
    if (memberIds.length === 0) {
      return { memberCount: 0, activeGoals: 0, completedGoals: 0, avgNorthStarScore: 0 };
    }

    const [goalStats, scoreRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) FILTER (WHERE ${goals.isCompleted} = true)`,
        })
        .from(goals)
        .where(and(inArray(goals.userId, memberIds), eq(goals.isArchived, false))),
      db
        .select({
          score: users.northStarScore,
        })
        .from(users)
        .where(inArray(users.id, memberIds)),
    ]);

    const totalScore = scoreRows.reduce((sum, row) => sum + row.score, 0);
    return {
      memberCount: members.length,
      activeGoals: goalStats[0]?.total ?? 0,
      completedGoals: goalStats[0]?.completed ?? 0,
      avgNorthStarScore:
        scoreRows.length > 0 ? Math.round(totalScore / scoreRows.length) : 0,
    };
  },
};

