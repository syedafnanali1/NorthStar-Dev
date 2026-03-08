// drizzle/schema.ts
// Complete database schema for North Star Goal Tracker
// All tables, relations, and types defined here

import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  pgEnum,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export const goalCategoryEnum = pgEnum("goal_category", [
  "health",
  "finance",
  "writing",
  "body",
  "mindset",
  "custom",
]);

export const moodEnum = pgEnum("mood", [
  "energized",
  "good",
  "neutral",
  "tired",
  "low",
  "focused",
  "anxious",
]);

export const sleepEnum = pgEnum("sleep", [
  "under_5",
  "five_to_6",
  "six_to_7",
  "seven_to_8",
  "over_8",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);

export const connectionStatusEnum = pgEnum("connection_status", [
  "pending",
  "accepted",
  "blocked",
]);

// ─── USERS ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `usr_${nanoid(12)}`),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  passwordHash: text("password_hash"),
  image: text("image"),
  // Profile
  age: integer("age"),
  location: text("location"),
  bio: text("bio"),
  // Settings
  darkMode: boolean("dark_mode").default(false).notNull(),
  // Stats (denormalized for performance)
  momentumScore: integer("momentum_score").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  totalGoalsCompleted: integer("total_goals_completed").default(0).notNull(),
  lastActiveAt: timestamp("last_active_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── ACCOUNTS (NextAuth OAuth) ────────────────────────────────────────────────

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

// ─── SESSIONS ────────────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ─── VERIFICATION TOKENS ─────────────────────────────────────────────────────

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─── PASSWORD RESET TOKENS ───────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `prt_${nanoid(24)}`),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").unique().notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── GOALS ────────────────────────────────────────────────────────────────────

export const goals = pgTable(
  "goals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `goal_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    why: text("why"),
    category: goalCategoryEnum("category").notNull(),
    color: text("color").notNull().default("#C4963A"),
    // Metric tracking
    targetValue: real("target_value"),
    currentValue: real("current_value").default(0).notNull(),
    unit: text("unit"),
    // Milestones stored as JSON array of strings
    milestones: jsonb("milestones").$type<string[]>().default([]).notNull(),
    // Completed milestones stored as JSON array of strings
    completedMilestones: jsonb("completed_milestones")
      .$type<string[]>()
      .default([])
      .notNull(),
    // Timeframe
    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    // Status
    isPublic: boolean("is_public").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    isCompleted: boolean("is_completed").default(false).notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    // Emoji for display
    emoji: text("emoji"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("goals_user_id_idx").on(table.userId),
    categoryIdx: index("goals_category_idx").on(table.category),
  })
);

// ─── GOAL TASKS (Linked Daily Intentions) ────────────────────────────────────

export const goalTasks = pgTable(
  "goal_tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `task_${nanoid(12)}`),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isRepeating: boolean("is_repeating").default(true).notNull(),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    goalIdIdx: index("goal_tasks_goal_id_idx").on(table.goalId),
  })
);

// ─── GOAL PROGRESS ENTRIES ───────────────────────────────────────────────────

export const progressEntries = pgTable(
  "progress_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `prog_${nanoid(12)}`),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: real("value").notNull(),
    note: text("note"),
    loggedAt: timestamp("logged_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    goalIdIdx: index("progress_entries_goal_id_idx").on(table.goalId),
    loggedAtIdx: index("progress_entries_logged_at_idx").on(table.loggedAt),
  })
);

// ─── MOMENTS (Story Thread Reflections) ──────────────────────────────────────

export const moments = pgTable(
  "moments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `mom_${nanoid(12)}`),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    // Visibility: 'private' | 'circle' | 'public'
    visibility: text("visibility").default("circle").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    goalIdIdx: index("moments_goal_id_idx").on(table.goalId),
    createdAtIdx: index("moments_created_at_idx").on(table.createdAt),
  })
);

// ─── DAILY LOGS ───────────────────────────────────────────────────────────────

export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `log_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Date stored as YYYY-MM-DD string for easy querying
    date: text("date").notNull(),
    mood: moodEnum("mood"),
    sleep: sleepEnum("sleep"),
    reflection: text("reflection"),
    // Completed task IDs for this day (JSON array)
    completedTaskIds: jsonb("completed_task_ids")
      .$type<string[]>()
      .default([])
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userDateIdx: uniqueIndex("daily_logs_user_date_idx").on(
      table.userId,
      table.date
    ),
  })
);

// ─── CIRCLE CONNECTIONS ───────────────────────────────────────────────────────

export const circleConnections = pgTable(
  "circle_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `conn_${nanoid(12)}`),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: connectionStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    requesterIdx: index("connections_requester_idx").on(table.requesterId),
    receiverIdx: index("connections_receiver_idx").on(table.receiverId),
  })
);

// ─── CIRCLE POSTS (Check-ins) ─────────────────────────────────────────────────

export const circlePosts = pgTable(
  "circle_posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `post_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    // 'circle' | 'community'
    visibility: text("visibility").default("circle").notNull(),
    // Reaction counts (denormalized)
    reactionCounts: jsonb("reaction_counts")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    replyCount: integer("reply_count").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("circle_posts_user_id_idx").on(table.userId),
    createdAtIdx: index("circle_posts_created_at_idx").on(table.createdAt),
  })
);

// ─── POST REACTIONS ───────────────────────────────────────────────────────────

export const postReactions = pgTable(
  "post_reactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `rxn_${nanoid(12)}`),
    postId: text("post_id")
      .notNull()
      .references(() => circlePosts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueReaction: uniqueIndex("unique_reaction_idx").on(
      table.postId,
      table.userId,
      table.emoji
    ),
  })
);

// ─── POST REPLIES ─────────────────────────────────────────────────────────────

export const postReplies = pgTable(
  "post_replies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `rply_${nanoid(12)}`),
    postId: text("post_id")
      .notNull()
      .references(() => circlePosts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    postIdIdx: index("post_replies_post_id_idx").on(table.postId),
  })
);

// ─── INVITATIONS ─────────────────────────────────────────────────────────────

export const invitations = pgTable(
  "invitations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `inv_${nanoid(12)}`),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The invited person's email or phone
    inviteeEmail: text("invitee_email"),
    inviteePhone: text("invitee_phone"),
    // A unique token used in the invitation link
    token: text("token")
      .unique()
      .notNull()
      .$defaultFn(() => nanoid(32)),
    status: invitationStatusEnum("status").default("pending").notNull(),
    goalIds: jsonb("goal_ids").$type<string[]>().default([]).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("invitations_token_idx").on(table.token),
    senderIdx: index("invitations_sender_idx").on(table.senderId),
  })
);

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ach_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementKey: text("achievement_key").notNull(),
    earnedAt: timestamp("earned_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueAchievement: uniqueIndex("unique_achievement_idx").on(
      table.userId,
      table.achievementKey
    ),
  })
);

// ─── SHARED GOALS ─────────────────────────────────────────────────────────────

export const sharedGoals = pgTable(
  "shared_goals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `sg_${nanoid(12)}`),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    sharedWithUserId: text("shared_with_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueSharedGoal: uniqueIndex("unique_shared_goal_idx").on(
      table.goalId,
      table.sharedWithUserId
    ),
  })
);

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  goals: many(goals),
  dailyLogs: many(dailyLogs),
  circlePosts: many(circlePosts),
  moments: many(moments),
  sentInvitations: many(invitations, { relationName: "sender" }),
  achievements: many(userAchievements),
  sentConnections: many(circleConnections, { relationName: "requester" }),
  receivedConnections: many(circleConnections, { relationName: "receiver" }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  tasks: many(goalTasks),
  progressEntries: many(progressEntries),
  moments: many(moments),
  circlePosts: many(circlePosts),
  sharedWith: many(sharedGoals),
}));

export const goalTasksRelations = relations(goalTasks, ({ one }) => ({
  goal: one(goals, { fields: [goalTasks.goalId], references: [goals.id] }),
  user: one(users, { fields: [goalTasks.userId], references: [users.id] }),
}));

export const progressEntriesRelations = relations(progressEntries, ({ one }) => ({
  goal: one(goals, { fields: [progressEntries.goalId], references: [goals.id] }),
  user: one(users, { fields: [progressEntries.userId], references: [users.id] }),
}));

export const momentsRelations = relations(moments, ({ one }) => ({
  goal: one(goals, { fields: [moments.goalId], references: [goals.id] }),
  user: one(users, { fields: [moments.userId], references: [users.id] }),
}));

export const dailyLogsRelations = relations(dailyLogs, ({ one }) => ({
  user: one(users, { fields: [dailyLogs.userId], references: [users.id] }),
}));

export const circlePostsRelations = relations(circlePosts, ({ one, many }) => ({
  user: one(users, { fields: [circlePosts.userId], references: [users.id] }),
  goal: one(goals, { fields: [circlePosts.goalId], references: [goals.id] }),
  reactions: many(postReactions),
  replies: many(postReplies),
}));

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(circlePosts, { fields: [postReactions.postId], references: [circlePosts.id] }),
  user: one(users, { fields: [postReactions.userId], references: [users.id] }),
}));

export const postRepliesRelations = relations(postReplies, ({ one }) => ({
  post: one(circlePosts, { fields: [postReplies.postId], references: [circlePosts.id] }),
  user: one(users, { fields: [postReplies.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  sender: one(users, {
    fields: [invitations.senderId],
    references: [users.id],
    relationName: "sender",
  }),
}));

export const circleConnectionsRelations = relations(
  circleConnections,
  ({ one }) => ({
    requester: one(users, {
      fields: [circleConnections.requesterId],
      references: [users.id],
      relationName: "requester",
    }),
    receiver: one(users, {
      fields: [circleConnections.receiverId],
      references: [users.id],
      relationName: "receiver",
    }),
  })
);

export const userAchievementsRelations = relations(
  userAchievements,
  ({ one }) => ({
    user: one(users, {
      fields: [userAchievements.userId],
      references: [users.id],
    }),
  })
);

// ─── TYPE EXPORTS ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type GoalTask = typeof goalTasks.$inferSelect;
export type NewGoalTask = typeof goalTasks.$inferInsert;
export type ProgressEntry = typeof progressEntries.$inferSelect;
export type NewProgressEntry = typeof progressEntries.$inferInsert;
export type Moment = typeof moments.$inferSelect;
export type NewMoment = typeof moments.$inferInsert;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type NewDailyLog = typeof dailyLogs.$inferInsert;
export type CirclePost = typeof circlePosts.$inferSelect;
export type NewCirclePost = typeof circlePosts.$inferInsert;
export type PostReaction = typeof postReactions.$inferSelect;
export type PostReply = typeof postReplies.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type CircleConnection = typeof circleConnections.$inferSelect;
