import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

// Keep the auth adapter pinned to the columns that exist in older deployed schemas.
// The broader app can read richer profile fields through its own compatibility fallbacks.
export const authUsersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

// Legacy-safe write surface for user creation flows while production is still
// missing newer profile columns from the full Drizzle schema.
export const legacyUsersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  username: text("username"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  passwordHash: text("password_hash"),
  image: text("image"),
  location: text("location"),
  bio: text("bio"),
  lastActiveAt: timestamp("last_active_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }),
});

export const authAccountsTable = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => authUsersTable.id, { onDelete: "cascade" }),
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

export const authSessionsTable = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => authUsersTable.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const authVerificationTokensTable = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compoundKey: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
);
