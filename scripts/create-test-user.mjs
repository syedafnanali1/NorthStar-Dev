// scripts/create-test-user.mjs
// One-shot script: creates a verified test account you can sign in with immediately.
// Run: node scripts/create-test-user.mjs

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Load .env.local ───────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "..", ".env.local");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  const [key, ...rest] = line.split("=");
  if (key && !key.startsWith("#") && rest.length > 0) {
    process.env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

// ── Dynamic imports (ESM) ─────────────────────────────────────────────────────
const { neon } = await import("@neondatabase/serverless");
const bcrypt = await import("bcryptjs");

const sql = neon(DATABASE_URL);

// ── Config ────────────────────────────────────────────────────────────────────
const TEST_EMAIL = "testuser@northstar.local";
const TEST_PASSWORD = "TestPass123!";
const TEST_NAME = "Test User";
const TEST_USERNAME = "test_northstar";

async function main() {
  console.log("Checking for existing test user…");

  const [existing] = await sql`
    SELECT id, email_verified FROM users
    WHERE lower(email) = ${TEST_EMAIL}
    LIMIT 1
  `;

  if (existing) {
    // Reset the account so onboarding runs fresh
    console.log("User exists — resetting onboarding and subscription…");
    await sql`
      UPDATE users SET
        has_completed_onboarding = false,
        email_verified = now()
      WHERE id = ${existing.id}
    `;
    // Delete existing goals
    await sql`DELETE FROM goals WHERE user_id = ${existing.id}`;
    // Reset subscription to free so the AI gate is visible
    await sql`
      INSERT INTO user_subscriptions (user_id, plan, status, price_cents, updated_at)
      VALUES (${existing.id}, 'free', 'active', 0, now())
      ON CONFLICT (user_id) DO UPDATE SET
        plan = 'free', status = 'active', updated_at = now()
    `;
    console.log("\n✓ Existing account reset to fresh state.\n");
  } else {
    console.log("Creating new test user…");
    const passwordHash = await bcrypt.default.hash(TEST_PASSWORD, 10);
    const userId = `usr_test${randomBytes(6).toString("hex")}`;
    const now = new Date().toISOString();

    await sql`
      INSERT INTO users (
        id, name, username, email, email_verified,
        password_hash, has_completed_onboarding,
        momentum_score, current_streak, longest_streak,
        total_goals_completed, xp_points, level,
        north_star_score, session_version, dark_mode,
        ai_coaching_enabled, timezone, push_notifications_enabled,
        groups_joined, group_goals_completed, group_comments_posted,
        group_reactions_given, group_invites_sent, group_invites_accepted,
        total_group_engagement_score
      ) VALUES (
        ${userId}, ${TEST_NAME}, ${TEST_USERNAME}, ${TEST_EMAIL}, ${now},
        ${passwordHash}, false,
        0, 0, 0, 0, 0, 1, 0, 1, false,
        true, 'UTC', true,
        0, 0, 0, 0, 0, 0, 0
      )
    `;

    await sql`
      INSERT INTO user_subscriptions (user_id, plan, status, price_cents, updated_at)
      VALUES (${userId}, 'free', 'active', 0, now())
      ON CONFLICT (user_id) DO NOTHING
    `;

    console.log("\n✓ Test user created.\n");
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Sign-in credentials");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Email    : ${TEST_EMAIL}`);
  console.log(`  Password : ${TEST_PASSWORD}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  URL      : http://localhost:3000/auth/login");
  console.log("  Plan     : free (AI gate visible)");
  console.log("  Onboarding: not completed → goes straight to carousel");
  console.log("\n  To activate premium: go to /premium → 'Test: Activate Pro'");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
