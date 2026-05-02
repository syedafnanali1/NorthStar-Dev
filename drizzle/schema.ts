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
  type AnyPgColumn,
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

export const aiInsightTypeEnum = pgEnum("ai_insight_type", [
  "weekly_review",
  "nudge",
  "correlation",
  "suggestion",
  "prediction",
]);

export const groupGoalRoleEnum = pgEnum("group_goal_role", [
  "creator",
  "member",
]);

export const groupGoalJoinRequestStatusEnum = pgEnum(
  "group_goal_join_request_status",
  ["pending", "approved", "rejected"]
);

export const notificationTypeEnum = pgEnum("notification_type", [
  "streak_risk",
  "friend_milestone",
  "achievement_unlocked",
  "weekly_review",
  "group_message",
  "comment",
  "reaction",
  "level_up",
  "challenge_update",
  "group_milestone",
  "friend_activity",
  "challenge_rank",
  "wearable_sync",
  "reengagement",
]);

export const templateSubmissionStatusEnum = pgEnum(
  "template_submission_status",
  ["pending", "approved", "rejected"]
);

export const friendActivityTypeEnum = pgEnum("friend_activity_type", [
  "progress_log",
  "goal_milestone",
  "goal_completed",
  "moment_shared",
  "challenge_joined",
  "challenge_completed",
  "group_milestone",
]);

export const challengeStatusEnum = pgEnum("challenge_status", [
  "upcoming",
  "active",
  "completed",
  "archived",
]);

export const wearableProviderEnum = pgEnum("wearable_provider", [
  "apple_health",
  "google_fit",
  "manual_import",
]);

export const wearableMetricTypeEnum = pgEnum("wearable_metric_type", [
  "steps",
  "distance_km",
  "sleep_hours",
  "calories",
  "heart_rate",
  "weight",
  "active_minutes",
]);

export const visionBoardItemTypeEnum = pgEnum("vision_board_item_type", [
  "image",
  "quote",
  "text",
]);

// ─── GROUP FEATURE ENUMS ──────────────────────────────────────────────────────

export const groupTypeEnum = pgEnum("group_type", ["public", "private"]);

export const groupCategoryEnum = pgEnum("group_category", [
  "health", "fitness", "finance", "mindset", "writing",
  "reading", "career", "lifestyle", "creativity", "community", "other",
]);

export const groupMemberRoleEnum = pgEnum("group_member_role", [
  "owner",
  "admin",
  "member",
]);

export const groupMemberStatusEnum = pgEnum("group_member_status", [
  "active",
  "pending",
  "banned",
]);

export const groupGoalCreatedViaEnum = pgEnum("group_goal_created_via", [
  "ai",
  "manual",
]);

export const groupGoalTrackingFrequencyEnum = pgEnum(
  "group_goal_tracking_frequency",
  ["daily", "weekly", "monthly", "yearly", "custom"]
);

export const groupGoalStatusEnum = pgEnum("group_goal_status", [
  "active",
  "completed",
  "archived",
]);

export const groupEngagementActionEnum = pgEnum("group_engagement_action", [
  "post_comment",
  "react",
  "complete_goal",
  "invite_member",
  "join_group",
  "add_to_calendar",
  "session_visit",
  "circle_request",
]);

// ─── USERS ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `usr_${nanoid(12)}`),
  name: text("name"),
  username: text("username").unique(),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  passwordHash: text("password_hash"),
  image: text("image"),
  phoneNumber: text("phone_number"),
  dateOfBirth: timestamp("date_of_birth", { mode: "date" }),
  countryRegion: text("country_region"),
  alwaysVerifySignIn: boolean("always_verify_sign_in").default(false).notNull(),
  lastStepUpVerifiedAt: timestamp("last_step_up_verified_at", { mode: "date" }),
  sessionVersion: integer("session_version").default(1).notNull(),
  // Profile
  age: integer("age"),
  location: text("location"),
  jobTitle: text("job_title"),
  bio: text("bio"),
  // Settings
  darkMode: boolean("dark_mode").default(false).notNull(),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
  aiCoachingEnabled: boolean("ai_coaching_enabled").default(true).notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  pushNotificationsEnabled: boolean("push_notifications_enabled").default(true).notNull(),
  // Stats (denormalized for performance)
  momentumScore: integer("momentum_score").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  totalGoalsCompleted: integer("total_goals_completed").default(0).notNull(),
  // XP / Leveling
  xpPoints: integer("xp_points").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  northStarScore: integer("north_star_score").default(0).notNull(),
  lastActiveAt: timestamp("last_active_at", { mode: "date" }),
  // ── Group engagement (denormalized; written on every group action for AI learning) ──
  groupsJoined: integer("groups_joined").default(0).notNull(),
  groupGoalsCompleted: integer("group_goals_completed").default(0).notNull(),
  groupCommentsPosted: integer("group_comments_posted").default(0).notNull(),
  groupReactionsGiven: integer("group_reactions_given").default(0).notNull(),
  groupInvitesSent: integer("group_invites_sent").default(0).notNull(),
  groupInvitesAccepted: integer("group_invites_accepted").default(0).notNull(),
  totalGroupEngagementScore: integer("total_group_engagement_score").default(0).notNull(),
  lastGroupActiveAt: timestamp("last_group_active_at", { mode: "date" }),
  // Flexible JSON blob for AI behavioral analysis across group actions
  groupBehaviorProfile: jsonb("group_behavior_profile")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  // ── Subscription / trial fields ──────────────────────────────────────────────
  trialStartDate: timestamp("trial_start_date", { mode: "date" }),
  isDemo: boolean("is_demo").default(false).notNull(),
  role: text("role").$type<"member" | "coach" | "admin">().default("member").notNull(),
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

// Authentication profile fields collected at registration
export const userAuthProfiles = pgTable("user_auth_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull(),
  dateOfBirth: timestamp("date_of_birth", { mode: "date" }).notNull(),
  countryRegion: text("country_region").notNull(),
  referralCode: text("referral_code"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// Login lockouts and failed-attempt counters
export const authLoginSecurity = pgTable("auth_login_security", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  lockUntil: timestamp("lock_until", { mode: "date" }),
  lastFailedAt: timestamp("last_failed_at", { mode: "date" }),
  lastSuccessfulAt: timestamp("last_successful_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// One-time passcodes for email verification and step-up verification
export const authEmailOtps = pgTable(
  "auth_email_otps",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `aotp_${nanoid(24)}`),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    purpose: text("purpose").notNull(),
    otpHash: text("otp_hash").notNull(),
    context: jsonb("context")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    emailPurposeIdx: index("auth_email_otps_email_purpose_idx").on(
      table.email,
      table.purpose,
      table.createdAt
    ),
    userPurposeIdx: index("auth_email_otps_user_purpose_idx").on(
      table.userId,
      table.purpose,
      table.createdAt
    ),
  })
);

// Trusted device fingerprints (hashed only)
export const userTrustedDevices = pgTable(
  "user_trusted_devices",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `utd_${nanoid(24)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fingerprintHash: text("fingerprint_hash").notNull(),
    deviceLabel: text("device_label"),
    ipAddress: text("ip_address"),
    country: text("country"),
    city: text("city"),
    trustedUntil: timestamp("trusted_until", { mode: "date" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userFingerprintUnique: uniqueIndex("user_trusted_devices_user_fp_uidx").on(
      table.userId,
      table.fingerprintHash
    ),
    userLastSeenIdx: index("user_trusted_devices_user_last_seen_idx").on(
      table.userId,
      table.lastSeenAt
    ),
  })
);

// Password history used to block reuse of the last 5 passwords
export const userPasswordHistory = pgTable(
  "user_password_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `uph_${nanoid(24)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("user_password_history_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

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
    // Group goal link — set when this personal goal mirrors a group goal item
    groupGoalItemId: text("group_goal_item_id"),
    groupId: text("group_id"),
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
    // Amount to auto-increment goal progress when this task is completed
    incrementValue: real("increment_value"),
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
    // nullable: null when this entry belongs to a group goal instead
    goalId: text("goal_id").references(() => goals.id, { onDelete: "cascade" }),
    // set when the entry is a group goal contribution
    groupGoalId: text("group_goal_id"),
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
    // True when user marks this as a perseverance moment ("didn't feel like it but did it anyway")
    isPerseverance: boolean("is_perseverance").default(false).notNull(),
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
    // Custom one-off intentions for this day (outside regular goal tasks)
    dailyIntentions: jsonb("daily_intentions")
      .$type<Array<{ id: string; text: string; done: boolean }>>()
      .default([])
      .notNull(),
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

export const friendQrCodes = pgTable(
  "friend_qr_codes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `fqr_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code")
      .unique()
      .notNull()
      .$defaultFn(() => nanoid(28)),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex("friend_qr_codes_code_idx").on(table.code),
    userIdx: index("friend_qr_codes_user_idx").on(table.userId),
  })
);

export const friendActivityEvents = pgTable(
  "friend_activity_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `fae_${nanoid(12)}`),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: friendActivityTypeEnum("type").notNull(),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    challengeId: text("challenge_id"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index("friend_activity_events_actor_idx").on(table.actorUserId),
    createdAtIdx: index("friend_activity_events_created_at_idx").on(table.createdAt),
  })
);

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

// ─── GROUP GOALS ──────────────────────────────────────────────────────────────

export const groupGoals = pgTable(
  "group_goals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `gg_${nanoid(12)}`),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: goalCategoryEnum("category").notNull(),
    targetValue: real("target_value"),
    currentValue: real("current_value").default(0).notNull(),
    unit: text("unit"),
    emoji: text("emoji"),
    color: text("color").notNull().default("#C4963A"),
    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    isPublic: boolean("is_public").default(false).notNull(),
    memberLimit: integer("member_limit").default(20).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("group_goals_creator_idx").on(table.creatorId),
    publicIdx: index("group_goals_public_idx").on(table.isPublic),
  })
);

export const groupGoalMembers = pgTable(
  "group_goal_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ggm_${nanoid(12)}`),
    groupGoalId: text("group_goal_id")
      .notNull()
      .references(() => groupGoals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contribution: real("contribution").default(0).notNull(),
    role: groupGoalRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueMember: uniqueIndex("group_goal_members_unique_idx").on(
      table.groupGoalId,
      table.userId
    ),
    groupGoalIdIdx: index("group_goal_members_group_idx").on(table.groupGoalId),
    userIdIdx: index("group_goal_members_user_idx").on(table.userId),
  })
);

export const groupGoalJoinRequests = pgTable(
  "group_goal_join_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ggjr_${nanoid(12)}`),
    groupGoalId: text("group_goal_id")
      .notNull()
      .references(() => groupGoals.id, { onDelete: "cascade" }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: groupGoalJoinRequestStatusEnum("status").default("pending").notNull(),
    note: text("note"),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueRequest: uniqueIndex("group_goal_join_requests_unique_idx").on(
      table.groupGoalId,
      table.requesterId
    ),
    groupGoalStatusIdx: index("group_goal_join_requests_group_status_idx").on(
      table.groupGoalId,
      table.status
    ),
    requesterIdx: index("group_goal_join_requests_requester_idx").on(table.requesterId),
  })
);

export const groupGoalMessages = pgTable(
  "group_goal_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ggmsg_${nanoid(12)}`),
    groupGoalId: text("group_goal_id")
      .notNull()
      .references(() => groupGoals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    groupGoalIdIdx: index("group_goal_messages_group_idx").on(table.groupGoalId),
    createdAtIdx: index("group_goal_messages_created_at_idx").on(table.createdAt),
  })
);

// ─── GOAL TEMPLATES ───────────────────────────────────────────────────────────

export const groupGoalMilestones = pgTable(
  "group_goal_milestones",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ggms_${nanoid(12)}`),
    groupGoalId: text("group_goal_id")
      .notNull()
      .references(() => groupGoals.id, { onDelete: "cascade" }),
    milestonePercent: integer("milestone_percent").notNull(),
    triggeredByUserId: text("triggered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueMilestone: uniqueIndex("group_goal_milestones_unique_idx").on(
      table.groupGoalId,
      table.milestonePercent
    ),
    groupIdx: index("group_goal_milestones_group_idx").on(table.groupGoalId),
  })
);

// ─── GROUPS (community containers) ───────────────────────────────────────────

export const groups = pgTable(
  "groups",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `grp_${nanoid(12)}`),
    name: text("name").notNull(),
    description: text("description"),
    type: groupTypeEnum("type").default("public").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coverImage: text("cover_image"),
    icon: text("icon").default("⭐"),
    // Denormalized counts — updated on every membership change
    memberCount: integer("member_count").default(0).notNull(),
    // Computed from group_engagement_logs; updated by background job or trigger
    engagementScore: integer("engagement_score").default(0).notNull(),
    // Rank among all groups; null until first ranking run
    popularityRank: integer("popularity_rank"),
    // Weighted popularity score 0-100: memberCount(30%) + comments30d(20%) + goalCompletionRate(30%) + recommendationRating(20%)
    popularityScore: real("popularity_score").default(0).notNull(),
    category: groupCategoryEnum("category"),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    typeIdx:     index("groups_type_idx").on(table.type),
    creatorIdx:  index("groups_creator_idx").on(table.createdBy),
    rankIdx:     index("groups_rank_idx").on(table.popularityRank),
    categoryIdx: index("groups_category_idx").on(table.category),
  })
);

// ─── GROUP MEMBERS ────────────────────────────────────────────────────────────

export const groupMembers = pgTable(
  "group_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `gmbr_${nanoid(12)}`),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupMemberRoleEnum("role").default("member").notNull(),
    status: groupMemberStatusEnum("status").default("active").notNull(),
    // Who sent the invitation that led to this membership (null if self-joined)
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at", { mode: "date" }),
    // Per-member engagement metrics for leaderboards and AI analysis
    engagementScore: integer("engagement_score").default(0).notNull(),
    goalsCompleted: integer("goals_completed").default(0).notNull(),
    commentsPosted: integer("comments_posted").default(0).notNull(),
    reactionsGiven: integer("reactions_given").default(0).notNull(),
    invitesSent: integer("invites_sent").default(0).notNull(),
    sessionVisits: integer("session_visits").default(0).notNull(),
    // Self-reported success / recommendation rating 1–10; contributes 20% of group popularity score
    recommendationRating: integer("recommendation_rating"),
  },
  (table) => ({
    uniqueMember: uniqueIndex("group_members_unique_idx").on(table.groupId, table.userId),
    groupIdx:     index("group_members_group_idx").on(table.groupId),
    userIdx:      index("group_members_user_idx").on(table.userId),
    statusIdx:    index("group_members_status_idx").on(table.groupId, table.status),
  })
);

// ─── GROUP INVITES ────────────────────────────────────────────────────────────

export const groupInvites = pgTable(
  "group_invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ginv_${nanoid(12)}`),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Exactly one of inviteeUserId or inviteeEmail must be set
    inviteeUserId: text("invitee_user_id").references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail: text("invitee_email"),
    status: invitationStatusEnum("status").default("pending").notNull(),
    sentAt: timestamp("sent_at", { mode: "date" }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    groupIdx:    index("group_invites_group_idx").on(table.groupId),
    inviterIdx:  index("group_invites_inviter_idx").on(table.invitedBy),
    inviteeIdx:  index("group_invites_invitee_user_idx").on(table.inviteeUserId),
    statusIdx:   index("group_invites_status_idx").on(table.groupId, table.status),
  })
);

// ─── GROUP JOIN REQUESTS (public groups only) ─────────────────────────────────

export const groupJoinRequests = pgTable(
  "group_join_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `gjr_${nanoid(12)}`),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: groupGoalJoinRequestStatusEnum("status").default("pending").notNull(),
    note: text("note"),
    requestedAt: timestamp("requested_at", { mode: "date" }).defaultNow().notNull(),
    reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
  },
  (table) => ({
    uniqueRequest: uniqueIndex("group_join_requests_unique_idx").on(table.groupId, table.requesterId),
    groupStatusIdx: index("group_join_requests_group_status_idx").on(table.groupId, table.status),
    requesterIdx:   index("group_join_requests_requester_idx").on(table.requesterId),
  })
);

// ─── GROUP GOAL ITEMS (goals scoped to a group) ───────────────────────────────

export const groupGoalItems = pgTable(
  "group_goal_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ggi_${nanoid(12)}`),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    category: goalCategoryEnum("category").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdVia: groupGoalCreatedViaEnum("created_via").default("manual").notNull(),
    trackingFrequency: groupGoalTrackingFrequencyEnum("tracking_frequency")
      .default("daily")
      .notNull(),
    // Only populated when trackingFrequency = "custom"
    customFrequencyLabel: text("custom_frequency_label"),
    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    // Stored as a JSON array of milestone label strings
    milestones: jsonb("milestones").$type<string[]>().default([]).notNull(),
    status: groupGoalStatusEnum("status").default("active").notNull(),
    targetValue: real("target_value"),
    currentValue: real("current_value").default(0).notNull(),
    unit: text("unit"),
    emoji: text("emoji"),
    color: text("color").default("#C4963A").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    groupIdx:    index("group_goal_items_group_idx").on(table.groupId),
    creatorIdx:  index("group_goal_items_creator_idx").on(table.createdBy),
    statusIdx:   index("group_goal_items_status_idx").on(table.groupId, table.status),
  })
);

// ─── GROUP GOAL MEMBER TRACKERS ──────────────────────────────────────────────
// One row per (user × group_goal_item) once a member clicks "Add to My Calendar".
// Tracks their personal check-in progress that feeds back into group aggregates.

export const groupGoalMemberTrackers = pgTable(
  "group_goal_member_trackers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ggmt_${nanoid(12)}`),
    groupGoalItemId: text("group_goal_item_id")
      .notNull()
      .references(() => groupGoalItems.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    checkInsCompleted: integer("check_ins_completed").default(0).notNull(),
    lastCheckedInAt: timestamp("last_checked_in_at", { mode: "date" }),
    isCompleted: boolean("is_completed").default(false).notNull(),
    addedAt: timestamp("added_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueTracker: uniqueIndex("group_goal_member_trackers_unique").on(
      table.groupGoalItemId,
      table.userId
    ),
    goalIdx:  index("group_goal_member_trackers_goal_idx").on(table.groupGoalItemId),
    userIdx:  index("group_goal_member_trackers_user_idx").on(table.userId),
    groupIdx: index("group_goal_member_trackers_group_idx").on(table.groupId),
  })
);

// ─── GROUP GOAL CHECK-INS ─────────────────────────────────────────────────────
// Individual progress entries logged by members against a group goal tracker.

export const groupGoalCheckIns = pgTable(
  "group_goal_check_ins",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ggci_${nanoid(12)}`),
    trackerId: text("tracker_id")
      .notNull()
      .references(() => groupGoalMemberTrackers.id, { onDelete: "cascade" }),
    groupGoalItemId: text("group_goal_item_id")
      .notNull()
      .references(() => groupGoalItems.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: real("value").default(1).notNull(),
    note: text("note"),
    loggedAt: timestamp("logged_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    trackerIdx: index("group_goal_check_ins_tracker_idx").on(table.trackerId),
    userIdx:    index("group_goal_check_ins_user_idx").on(table.userId),
    goalIdx:    index("group_goal_check_ins_goal_idx").on(table.groupGoalItemId),
  })
);

// ─── GROUP CHAT POSTS ─────────────────────────────────────────────────────────
// Content capped at 100 words — enforced in the API layer before insert.

export const groupChatPosts = pgTable(
  "group_chat_posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `gcp_${nanoid(12)}`),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Server validates word count <= 100 before insert/update
    content: text("content").notNull(),
    // [{ userId: string, emoji: string }] — one reaction per user per emoji
    reactions: jsonb("reactions")
      .$type<Array<{ userId: string; emoji: string }>>()
      .default([])
      .notNull(),
    commentCount: integer("comment_count").default(0).notNull(),
    editedAt: timestamp("edited_at", { mode: "date" }),
    // Soft-delete: content replaced with null equivalent but row retained for reaction counts
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    groupIdx:     index("group_chat_posts_group_idx").on(table.groupId),
    authorIdx:    index("group_chat_posts_author_idx").on(table.authorId),
    createdAtIdx: index("group_chat_posts_created_at_idx").on(table.groupId, table.createdAt),
  })
);

// ─── GROUP CHAT COMMENTS ──────────────────────────────────────────────────────
// Per-post comment threads; content capped at 100 words (API-enforced).

export const groupChatComments = pgTable(
  "group_chat_comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `gcc_${nanoid(12)}`),
    postId: text("post_id")
      .notNull()
      .references(() => groupChatPosts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    postIdx:   index("group_chat_comments_post_idx").on(table.postId),
    authorIdx: index("group_chat_comments_author_idx").on(table.authorId),
  })
);

// ─── GROUP ENGAGEMENT LOGS ────────────────────────────────────────────────────
// Append-only audit log. Every group action writes one row here AND increments
// the corresponding counter on users.group_behavior_profile for AI analysis.

export const groupEngagementLogs = pgTable(
  "group_engagement_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `gel_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    action: groupEngagementActionEnum("action").notNull(),
    // Flexible payload — e.g. { goalId, postId, emoji, inviteeId }
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    timestamp: timestamp("timestamp", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx:      index("group_engagement_logs_user_idx").on(table.userId),
    groupIdx:     index("group_engagement_logs_group_idx").on(table.groupId),
    actionIdx:    index("group_engagement_logs_action_idx").on(table.action),
    timelineIdx:  index("group_engagement_logs_timeline_idx").on(table.userId, table.timestamp),
  })
);

export const challenges = pgTable(
  "challenges",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `chl_${nanoid(12)}`),
    creatorId: text("creator_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    category: goalCategoryEnum("category").default("custom").notNull(),
    targetValue: real("target_value").notNull(),
    unit: text("unit").notNull(),
    startDate: timestamp("start_date", { mode: "date" }).notNull(),
    endDate: timestamp("end_date", { mode: "date" }).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    isSponsored: boolean("is_sponsored").default(false).notNull(),
    sponsorName: text("sponsor_name"),
    sponsorPrize: text("sponsor_prize"),
    isAiMicro: boolean("is_ai_micro").default(false).notNull(),
    status: challengeStatusEnum("status").default("upcoming").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index("challenges_status_idx").on(table.status),
    publicIdx: index("challenges_public_idx").on(table.isPublic),
    startIdx: index("challenges_start_idx").on(table.startDate),
  })
);

export const challengeParticipants = pgTable(
  "challenge_participants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `chp_${nanoid(12)}`),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentValue: real("current_value").default(0).notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
  },
  (table) => ({
    uniqueParticipant: uniqueIndex("challenge_participants_unique_idx").on(
      table.challengeId,
      table.userId
    ),
    challengeIdx: index("challenge_participants_challenge_idx").on(table.challengeId),
    userIdx: index("challenge_participants_user_idx").on(table.userId),
  })
);

export const challengeProgressEntries = pgTable(
  "challenge_progress_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `chpr_${nanoid(12)}`),
    challengeId: text("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: real("value").notNull(),
    note: text("note"),
    loggedAt: timestamp("logged_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    challengeIdx: index("challenge_progress_entries_challenge_idx").on(table.challengeId),
    userIdx: index("challenge_progress_entries_user_idx").on(table.userId),
    loggedAtIdx: index("challenge_progress_entries_logged_at_idx").on(table.loggedAt),
  })
);

export const wearableConnections = pgTable(
  "wearable_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `wrc_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: wearableProviderEnum("provider").notNull(),
    externalUserId: text("external_user_id"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    scopes: jsonb("scopes").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueProviderPerUser: uniqueIndex("wearable_connections_unique_idx").on(
      table.userId,
      table.provider
    ),
    userIdx: index("wearable_connections_user_idx").on(table.userId),
  })
);

export const wearableDataPoints = pgTable(
  "wearable_data_points",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `wdp_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: wearableProviderEnum("provider").notNull(),
    metricType: wearableMetricTypeEnum("metric_type").notNull(),
    value: real("value").notNull(),
    recordedAt: timestamp("recorded_at", { mode: "date" }).notNull(),
    sourcePayload: jsonb("source_payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userMetricDateIdx: index("wearable_data_points_user_metric_idx").on(
      table.userId,
      table.metricType,
      table.recordedAt
    ),
    uniqueSampleIdx: uniqueIndex("wearable_data_points_unique_idx").on(
      table.userId,
      table.provider,
      table.metricType,
      table.recordedAt
    ),
  })
);

export const goalVisionBoardItems = pgTable(
  "goal_vision_board_items",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `vbi_${nanoid(12)}`),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemType: visionBoardItemTypeEnum("item_type").notNull(),
    content: text("content").notNull(),
    assetUrl: text("asset_url"),
    quoteAuthor: text("quote_author"),
    x: real("x").default(0.5).notNull(),
    y: real("y").default(0.5).notNull(),
    width: real("width").default(0.3).notNull(),
    height: real("height").default(0.2).notNull(),
    zIndex: integer("z_index").default(0).notNull(),
    style: jsonb("style")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    goalIdx: index("goal_vision_board_items_goal_idx").on(table.goalId),
    userIdx: index("goal_vision_board_items_user_idx").on(table.userId),
    goalZIdx: index("goal_vision_board_items_goal_z_idx").on(table.goalId, table.zIndex),
  })
);

export const goalTemplates = pgTable("goal_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => `tpl_${nanoid(12)}`),
  title: text("title").notNull(),
  category: goalCategoryEnum("category").notNull(),
  emoji: text("emoji").notNull(),
  color: text("color").notNull().default("#C4963A"),
  description: text("description").notNull(),
  targetValue: real("target_value"),
  unit: text("unit"),
  suggestedMilestones: jsonb("suggested_milestones").$type<string[]>().default([]).notNull(),
  suggestedTasks: jsonb("suggested_tasks").$type<string[]>().default([]).notNull(),
  motivationalPrompts: jsonb("motivational_prompts")
    .$type<string[]>()
    .default([])
    .notNull(),
  timeframeDays: integer("timeframe_days"),
  isOfficial: boolean("is_official").default(false).notNull(),
  isCommunity: boolean("is_community").default(false).notNull(),
  submissionStatus: templateSubmissionStatusEnum("submission_status")
    .default("approved")
    .notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // Legacy columns kept for backwards compat
  defaultWhy: text("default_why"),
  defaultTasks: jsonb("default_tasks").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `notif_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    channel: text("channel").default("in_app").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    scheduledFor: timestamp("scheduled_for", { mode: "date" }),
    sentAt: timestamp("sent_at", { mode: "date" }),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIsReadIdx: index("notifications_user_id_is_read_idx").on(table.userId, table.isRead, table.createdAt),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
    scheduledIdx: index("notifications_scheduled_idx").on(table.scheduledFor),
  })
);

// ─── AI INSIGHTS ──────────────────────────────────────────────────────────────

export const aiInsights = pgTable(
  "ai_insights",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ai_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: aiInsightTypeEnum("type").notNull(),
    content: text("content").notNull(),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("ai_insights_user_id_idx").on(table.userId),
    createdAtIdx: index("ai_insights_created_at_idx").on(table.createdAt),
  })
);

// ─── COMMENTS ─────────────────────────────────────────────────────────────────

export const comments = pgTable(
  "comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `cmt_${nanoid(12)}`),
    postId: text("post_id")
      .notNull()
      .references(() => circlePosts.id, { onDelete: "cascade" }),
    parentCommentId: text("parent_comment_id").references(
      (): AnyPgColumn => comments.id,
      { onDelete: "cascade" }
    ),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    postIdCreatedAtIdx: index("comments_post_id_created_at_idx").on(table.postId, table.createdAt),
    userIdIdx: index("comments_user_id_idx").on(table.userId),
  })
);

// ─── RELATIONS ────────────────────────────────────────────────────────────────

export const weeklyAccountabilityCheckins = pgTable(
  "weekly_accountability_checkins",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `wkc_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStartDate: text("week_start_date").notNull(),
    answers: jsonb("answers").$type<string[]>().default([]).notNull(),
    aiReport: text("ai_report"),
    sharedToCircle: boolean("shared_to_circle").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserWeek: uniqueIndex("weekly_checkins_user_week_idx").on(
      table.userId,
      table.weekStartDate
    ),
    userCreatedIdx: index("weekly_checkins_user_created_idx").on(table.userId, table.createdAt),
  })
);

export const streakProtectionEvents = pgTable(
  "streak_protection_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `spe_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    helperUserId: text("helper_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    targetDate: text("target_date"),
    note: text("note"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userTypeDateIdx: index("streak_events_user_type_date_idx").on(
      table.userId,
      table.eventType,
      table.createdAt
    ),
    helperIdx: index("streak_events_helper_idx").on(table.helperUserId),
  })
);

export const goalStories = pgTable(
  "goal_stories",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `stry_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    text: text("text"),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userExpiresIdx: index("goal_stories_user_expires_idx").on(table.userId, table.expiresAt),
    goalIdx: index("goal_stories_goal_idx").on(table.goalId),
  })
);

export const coachProfiles = pgTable(
  "coach_profiles",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `coach_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    headline: text("headline"),
    bio: text("bio"),
    referralCode: text("referral_code").notNull(),
    commissionRate: real("commission_rate").default(0.2).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueCoachUser: uniqueIndex("coach_profiles_user_idx").on(table.userId),
    uniqueReferralCode: uniqueIndex("coach_profiles_referral_code_idx").on(
      table.referralCode
    ),
  })
);

export const coachClientLinks = pgTable(
  "coach_client_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `ccl_${nanoid(12)}`),
    coachUserId: text("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientUserId: text("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueCoachClient: uniqueIndex("coach_client_links_unique_idx").on(
      table.coachUserId,
      table.clientUserId
    ),
    coachIdx: index("coach_client_links_coach_idx").on(table.coachUserId),
    clientIdx: index("coach_client_links_client_idx").on(table.clientUserId),
  })
);

export const coachReferralConversions = pgTable(
  "coach_referral_conversions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `crf_${nanoid(12)}`),
    coachUserId: text("coach_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientUserId: text("client_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    revenueCents: integer("revenue_cents").notNull(),
    commissionCents: integer("commission_cents").notNull(),
    convertedAt: timestamp("converted_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    coachIdx: index("coach_referrals_coach_idx").on(table.coachUserId),
    clientIdx: index("coach_referrals_client_idx").on(table.clientUserId),
  })
);

export const userSubscriptions = pgTable(
  "user_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `sub_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").default("free").notNull(),
    status: text("status").default("active").notNull(),
    priceCents: integer("price_cents").default(0).notNull(),
    renewsAt: timestamp("renews_at", { mode: "date" }),
    trialStartDate: timestamp("trial_start_date", { mode: "date" }),
    planStartDate: timestamp("plan_start_date", { mode: "date" }),
    planExpiresDate: timestamp("plan_expires_date", { mode: "date" }),
    stripeCustomerId: text("stripe_customer_id"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUser: uniqueIndex("user_subscriptions_user_idx").on(table.userId),
    planIdx: index("user_subscriptions_plan_idx").on(table.plan),
  })
);

export const teamWorkspaces = pgTable(
  "team_workspaces",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `team_${nanoid(12)}`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueSlug: uniqueIndex("team_workspaces_slug_idx").on(table.slug),
    ownerIdx: index("team_workspaces_owner_idx").on(table.ownerUserId),
  })
);

export const teamWorkspaceMembers = pgTable(
  "team_workspace_members",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `tmem_${nanoid(12)}`),
    teamId: text("team_id")
      .notNull()
      .references(() => teamWorkspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueMember: uniqueIndex("team_workspace_members_unique_idx").on(
      table.teamId,
      table.userId
    ),
    teamIdx: index("team_workspace_members_team_idx").on(table.teamId),
    userIdx: index("team_workspace_members_user_idx").on(table.userId),
  })
);

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `int_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserProvider: uniqueIndex("integration_connections_unique_idx").on(
      table.userId,
      table.provider
    ),
    userIdx: index("integration_connections_user_idx").on(table.userId),
  })
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `whk_${nanoid(12)}`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teamWorkspaces.id, {
      onDelete: "set null",
    }),
    endpointUrl: text("endpoint_url").notNull(),
    secret: text("secret").notNull(),
    events: jsonb("events").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("webhook_subscriptions_user_idx").on(table.userId),
    teamIdx: index("webhook_subscriptions_team_idx").on(table.teamId),
    activeIdx: index("webhook_subscriptions_active_idx").on(table.isActive),
  })
);

// ─── DIRECT MESSAGES ─────────────────────────────────────────────────────────

export const directMessages = pgTable(
  "direct_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => `dm_${nanoid(12)}`),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    senderIdx:      index("dm_sender_idx").on(table.senderId),
    receiverIdx:    index("dm_receiver_idx").on(table.receiverId),
    conversationIdx: index("dm_conversation_idx").on(table.senderId, table.receiverId, table.createdAt),
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  goals: many(goals),
  dailyLogs: many(dailyLogs),
  circlePosts: many(circlePosts),
  moments: many(moments),
  sentInvitations: many(invitations, { relationName: "sender" }),
  friendQrCodes: many(friendQrCodes),
  friendActivityEvents: many(friendActivityEvents, { relationName: "friend_activity_actor" }),
  achievements: many(userAchievements),
  sentConnections: many(circleConnections, { relationName: "requester" }),
  receivedConnections: many(circleConnections, { relationName: "receiver" }),
  notifications: many(notifications),
  challengeParticipations: many(challengeParticipants),
  createdChallenges: many(challenges, { relationName: "challenge_creator" }),
  challengeProgressEntries: many(challengeProgressEntries),
  wearableConnections: many(wearableConnections),
  wearableDataPoints: many(wearableDataPoints),
  visionBoardItems: many(goalVisionBoardItems),
  groupGoalMilestones: many(groupGoalMilestones, { relationName: "group_milestone_triggerer" }),
  // Group feature
  createdGroups:       many(groups,              { relationName: "group_creator" }),
  groupMemberships:    many(groupMembers,         { relationName: "group_member_user" }),
  sentGroupInvites:    many(groupInvites,         { relationName: "group_invite_sender" }),
  receivedGroupInvites:many(groupInvites,         { relationName: "group_invite_recipient" }),
  groupJoinRequests:   many(groupJoinRequests,    { relationName: "group_join_requester" }),
  reviewedJoinRequests:many(groupJoinRequests,    { relationName: "group_join_reviewer" }),
  createdGroupGoals:   many(groupGoalItems,       { relationName: "group_goal_creator" }),
  groupChatPosts:      many(groupChatPosts,       { relationName: "group_chat_author" }),
  groupChatComments:   many(groupChatComments,    { relationName: "group_chat_comment_author" }),
  groupEngagementLogs: many(groupEngagementLogs,  { relationName: "group_engagement_user" }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  tasks: many(goalTasks),
  progressEntries: many(progressEntries),
  moments: many(moments),
  circlePosts: many(circlePosts),
  sharedWith: many(sharedGoals),
  friendActivityEvents: many(friendActivityEvents),
  visionBoardItems: many(goalVisionBoardItems),
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

export const friendQrCodesRelations = relations(friendQrCodes, ({ one }) => ({
  user: one(users, { fields: [friendQrCodes.userId], references: [users.id] }),
}));

export const friendActivityEventsRelations = relations(
  friendActivityEvents,
  ({ one }) => ({
    actor: one(users, {
      fields: [friendActivityEvents.actorUserId],
      references: [users.id],
      relationName: "friend_activity_actor",
    }),
    goal: one(goals, {
      fields: [friendActivityEvents.goalId],
      references: [goals.id],
    }),
  })
);

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

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  user: one(users, { fields: [aiInsights.userId], references: [users.id] }),
  goal: one(goals, { fields: [aiInsights.goalId], references: [goals.id] }),
}));

export const goalTemplatesRelations = relations(goalTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [goalTemplates.createdByUserId],
    references: [users.id],
  }),
}));

export const groupGoalsRelations = relations(groupGoals, ({ one, many }) => ({
  creator: one(users, { fields: [groupGoals.creatorId], references: [users.id] }),
  members: many(groupGoalMembers),
  joinRequests: many(groupGoalJoinRequests),
  messages: many(groupGoalMessages),
}));

export const groupGoalMembersRelations = relations(groupGoalMembers, ({ one }) => ({
  groupGoal: one(groupGoals, { fields: [groupGoalMembers.groupGoalId], references: [groupGoals.id] }),
  user: one(users, { fields: [groupGoalMembers.userId], references: [users.id] }),
}));

export const groupGoalJoinRequestsRelations = relations(groupGoalJoinRequests, ({ one }) => ({
  groupGoal: one(groupGoals, {
    fields: [groupGoalJoinRequests.groupGoalId],
    references: [groupGoals.id],
  }),
  requester: one(users, {
    fields: [groupGoalJoinRequests.requesterId],
    references: [users.id],
    relationName: "group_goal_join_request_requester",
  }),
  reviewedBy: one(users, {
    fields: [groupGoalJoinRequests.reviewedByUserId],
    references: [users.id],
    relationName: "group_goal_join_request_reviewer",
  }),
}));

export const groupGoalMessagesRelations = relations(groupGoalMessages, ({ one }) => ({
  groupGoal: one(groupGoals, { fields: [groupGoalMessages.groupGoalId], references: [groupGoals.id] }),
  user: one(users, { fields: [groupGoalMessages.userId], references: [users.id] }),
}));

export const groupGoalMilestonesRelations = relations(groupGoalMilestones, ({ one }) => ({
  groupGoal: one(groupGoals, {
    fields: [groupGoalMilestones.groupGoalId],
    references: [groupGoals.id],
  }),
  triggeredBy: one(users, {
    fields: [groupGoalMilestones.triggeredByUserId],
    references: [users.id],
    relationName: "group_milestone_triggerer",
  }),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  creator: one(users, {
    fields: [challenges.creatorId],
    references: [users.id],
    relationName: "challenge_creator",
  }),
  participants: many(challengeParticipants),
  progressEntries: many(challengeProgressEntries),
}));

export const challengeParticipantsRelations = relations(
  challengeParticipants,
  ({ one }) => ({
    challenge: one(challenges, {
      fields: [challengeParticipants.challengeId],
      references: [challenges.id],
    }),
    user: one(users, {
      fields: [challengeParticipants.userId],
      references: [users.id],
    }),
  })
);

export const challengeProgressEntriesRelations = relations(
  challengeProgressEntries,
  ({ one }) => ({
    challenge: one(challenges, {
      fields: [challengeProgressEntries.challengeId],
      references: [challenges.id],
    }),
    user: one(users, {
      fields: [challengeProgressEntries.userId],
      references: [users.id],
    }),
  })
);

export const wearableConnectionsRelations = relations(wearableConnections, ({ one }) => ({
  user: one(users, {
    fields: [wearableConnections.userId],
    references: [users.id],
  }),
}));

export const wearableDataPointsRelations = relations(wearableDataPoints, ({ one }) => ({
  user: one(users, {
    fields: [wearableDataPoints.userId],
    references: [users.id],
  }),
}));

export const goalVisionBoardItemsRelations = relations(goalVisionBoardItems, ({ one }) => ({
  goal: one(goals, {
    fields: [goalVisionBoardItems.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [goalVisionBoardItems.userId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(circlePosts, { fields: [comments.postId], references: [circlePosts.id] }),
  author: one(users, { fields: [comments.userId], references: [users.id] }),
  parent: one(comments, { fields: [comments.parentCommentId], references: [comments.id], relationName: "parent" }),
  replies: many(comments, { relationName: "parent" }),
}));

// ─── TYPE EXPORTS ─────────────────────────────────────────────────────────────

// ─── GROUP FEATURE RELATIONS ──────────────────────────────────────────────────

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator:       one(users,           { fields: [groups.createdBy],    references: [users.id], relationName: "group_creator" }),
  members:       many(groupMembers),
  invites:       many(groupInvites),
  joinRequests:  many(groupJoinRequests),
  goalItems:     many(groupGoalItems),
  chatPosts:     many(groupChatPosts),
  engagementLogs:many(groupEngagementLogs),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group:     one(groups, { fields: [groupMembers.groupId],   references: [groups.id] }),
  user:      one(users,  { fields: [groupMembers.userId],    references: [users.id],    relationName: "group_member_user" }),
  inviter:   one(users,  { fields: [groupMembers.invitedBy], references: [users.id],    relationName: "group_member_inviter" }),
}));

export const groupInvitesRelations = relations(groupInvites, ({ one }) => ({
  group:        one(groups, { fields: [groupInvites.groupId],        references: [groups.id] }),
  sender:       one(users,  { fields: [groupInvites.invitedBy],      references: [users.id], relationName: "group_invite_sender" }),
  inviteeUser:  one(users,  { fields: [groupInvites.inviteeUserId],  references: [users.id], relationName: "group_invite_recipient" }),
}));

export const groupJoinRequestsRelations = relations(groupJoinRequests, ({ one }) => ({
  group:    one(groups, { fields: [groupJoinRequests.groupId],     references: [groups.id] }),
  requester:one(users,  { fields: [groupJoinRequests.requesterId], references: [users.id], relationName: "group_join_requester" }),
  reviewer: one(users,  { fields: [groupJoinRequests.reviewedBy],  references: [users.id], relationName: "group_join_reviewer" }),
}));

export const groupGoalItemsRelations = relations(groupGoalItems, ({ one }) => ({
  group:   one(groups, { fields: [groupGoalItems.groupId],   references: [groups.id] }),
  creator: one(users,  { fields: [groupGoalItems.createdBy], references: [users.id], relationName: "group_goal_creator" }),
}));

export const groupChatPostsRelations = relations(groupChatPosts, ({ one, many }) => ({
  group:    one(groups, { fields: [groupChatPosts.groupId],  references: [groups.id] }),
  author:   one(users,  { fields: [groupChatPosts.authorId], references: [users.id], relationName: "group_chat_author" }),
  comments: many(groupChatComments),
}));

export const groupChatCommentsRelations = relations(groupChatComments, ({ one }) => ({
  post:   one(groupChatPosts, { fields: [groupChatComments.postId],   references: [groupChatPosts.id] }),
  author: one(users,          { fields: [groupChatComments.authorId], references: [users.id], relationName: "group_chat_comment_author" }),
}));

export const groupEngagementLogsRelations = relations(groupEngagementLogs, ({ one }) => ({
  user:  one(users,  { fields: [groupEngagementLogs.userId],  references: [users.id],  relationName: "group_engagement_user" }),
  group: one(groups, { fields: [groupEngagementLogs.groupId], references: [groups.id] }),
}));

// ─── GOAL INTENTIONS ──────────────────────────────────────────────────────────

export const goalIntentions = pgTable(
  "goal_intentions",
  {
    id:             text("id").primaryKey().$defaultFn(() => `gin_${nanoid(12)}`),
    goalId:         text("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    userId:         text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title:          text("title").notNull(),
    scheduledAt:    timestamp("scheduled_at"),
    recurrence:     text("recurrence", { enum: ["none", "daily", "weekly", "monthly", "custom"] }).default("none").notNull(),
    notes:          text("notes"),
    isDefault:      boolean("is_default").default(false).notNull(),
    createdAt:      timestamp("created_at").defaultNow().notNull(),
    updatedAt:      timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("goal_intentions_goal_idx").on(t.goalId),
    index("goal_intentions_user_idx").on(t.userId),
  ]
);

export const intentionRsvps = pgTable(
  "intention_rsvps",
  {
    id:          text("id").primaryKey().$defaultFn(() => `rsvp_${nanoid(12)}`),
    intentionId: text("intention_id").notNull().references(() => goalIntentions.id, { onDelete: "cascade" }),
    userId:      text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status:      text("status", { enum: ["attending", "not_attending"] }).notNull(),
    createdAt:   timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("intention_rsvp_unique").on(t.intentionId, t.userId),
  ]
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id:         text("id").primaryKey().$defaultFn(() => `aev_${nanoid(12)}`),
    userId:     text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    eventType:  text("event_type").notNull(),
    entityType: text("entity_type"),
    entityId:   text("entity_id"),
    metadata:   jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (t) => [
    index("analytics_events_user_idx").on(t.userId),
    index("analytics_events_type_idx").on(t.eventType),
    index("analytics_events_at_idx").on(t.occurredAt),
  ]
);

export const nudgeLogs = pgTable(
  "nudge_logs",
  {
    id:        text("id").primaryKey().$defaultFn(() => `ndg_${nanoid(12)}`),
    userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    nudgeType: text("nudge_type").notNull(),
    shownAt:   timestamp("shown_at").defaultNow().notNull(),
  },
  (t) => [index("nudge_logs_user_idx").on(t.userId)]
);

export const goalIntentionsRelations = relations(goalIntentions, ({ one, many }) => ({
  goal:  one(goals, { fields: [goalIntentions.goalId], references: [goals.id] }),
  user:  one(users, { fields: [goalIntentions.userId], references: [users.id] }),
  rsvps: many(intentionRsvps),
}));

export const intentionRsvpsRelations = relations(intentionRsvps, ({ one }) => ({
  intention: one(goalIntentions, { fields: [intentionRsvps.intentionId], references: [goalIntentions.id] }),
  user:      one(users, { fields: [intentionRsvps.userId], references: [users.id] }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, { fields: [analyticsEvents.userId], references: [users.id] }),
}));

export const nudgeLogsRelations = relations(nudgeLogs, ({ one }) => ({
  user: one(users, { fields: [nudgeLogs.userId], references: [users.id] }),
}));

// ─── TYPES ────────────────────────────────────────────────────────────────────

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
export type FriendQrCode = typeof friendQrCodes.$inferSelect;
export type NewFriendQrCode = typeof friendQrCodes.$inferInsert;
export type FriendActivityEvent = typeof friendActivityEvents.$inferSelect;
export type NewFriendActivityEvent = typeof friendActivityEvents.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type CircleConnection = typeof circleConnections.$inferSelect;
export type GoalTemplate = typeof goalTemplates.$inferSelect;
export type NewGoalTemplate = typeof goalTemplates.$inferInsert;
export type AiInsight = typeof aiInsights.$inferSelect;
export type NewAiInsight = typeof aiInsights.$inferInsert;
export type GroupGoal = typeof groupGoals.$inferSelect;
export type NewGroupGoal = typeof groupGoals.$inferInsert;
export type GroupGoalMember = typeof groupGoalMembers.$inferSelect;
export type GroupGoalJoinRequest = typeof groupGoalJoinRequests.$inferSelect;
export type GroupGoalMessage = typeof groupGoalMessages.$inferSelect;
export type GroupGoalMilestone = typeof groupGoalMilestones.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
export type ChallengeParticipant = typeof challengeParticipants.$inferSelect;
export type NewChallengeParticipant = typeof challengeParticipants.$inferInsert;
export type ChallengeProgressEntry = typeof challengeProgressEntries.$inferSelect;
export type NewChallengeProgressEntry = typeof challengeProgressEntries.$inferInsert;
export type WearableConnection = typeof wearableConnections.$inferSelect;
export type NewWearableConnection = typeof wearableConnections.$inferInsert;
export type WearableDataPoint = typeof wearableDataPoints.$inferSelect;
export type NewWearableDataPoint = typeof wearableDataPoints.$inferInsert;
export type GoalVisionBoardItem = typeof goalVisionBoardItems.$inferSelect;
export type NewGoalVisionBoardItem = typeof goalVisionBoardItems.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type WeeklyAccountabilityCheckin = typeof weeklyAccountabilityCheckins.$inferSelect;
export type NewWeeklyAccountabilityCheckin = typeof weeklyAccountabilityCheckins.$inferInsert;
export type StreakProtectionEvent = typeof streakProtectionEvents.$inferSelect;
export type NewStreakProtectionEvent = typeof streakProtectionEvents.$inferInsert;
export type GoalStory = typeof goalStories.$inferSelect;
export type NewGoalStory = typeof goalStories.$inferInsert;
export type CoachProfile = typeof coachProfiles.$inferSelect;
export type CoachClientLink = typeof coachClientLinks.$inferSelect;
export type CoachReferralConversion = typeof coachReferralConversions.$inferSelect;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type TeamWorkspace = typeof teamWorkspaces.$inferSelect;
export type TeamWorkspaceMember = typeof teamWorkspaceMembers.$inferSelect;
export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
// Group feature
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupMember = typeof groupMembers.$inferSelect;
export type NewGroupMember = typeof groupMembers.$inferInsert;
export type GroupInvite = typeof groupInvites.$inferSelect;
export type NewGroupInvite = typeof groupInvites.$inferInsert;
export type GroupJoinRequest = typeof groupJoinRequests.$inferSelect;
export type NewGroupJoinRequest = typeof groupJoinRequests.$inferInsert;
export type GroupGoalItem = typeof groupGoalItems.$inferSelect;
export type NewGroupGoalItem = typeof groupGoalItems.$inferInsert;
export type GroupGoalMemberTracker = typeof groupGoalMemberTrackers.$inferSelect;
export type NewGroupGoalMemberTracker = typeof groupGoalMemberTrackers.$inferInsert;
export type GroupGoalCheckIn = typeof groupGoalCheckIns.$inferSelect;
export type NewGroupGoalCheckIn = typeof groupGoalCheckIns.$inferInsert;
export type GroupChatPost = typeof groupChatPosts.$inferSelect;
export type NewGroupChatPost = typeof groupChatPosts.$inferInsert;
export type GroupChatComment = typeof groupChatComments.$inferSelect;
export type NewGroupChatComment = typeof groupChatComments.$inferInsert;
export type GroupEngagementLog = typeof groupEngagementLogs.$inferSelect;
export type NewGroupEngagementLog = typeof groupEngagementLogs.$inferInsert;
export type GoalIntention = typeof goalIntentions.$inferSelect;
export type NewGoalIntention = typeof goalIntentions.$inferInsert;
export type IntentionRsvp = typeof intentionRsvps.$inferSelect;
export type NewIntentionRsvp = typeof intentionRsvps.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type NudgeLog = typeof nudgeLogs.$inferSelect;
