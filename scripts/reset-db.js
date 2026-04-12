#!/usr/bin/env node
/**
 * Database reset script
 * Clears all data but keeps one user, one goal, and one group
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function resetDatabase() {
  console.log("🧹 Starting database reset...\n");

  try {
    // Get the first user (we'll keep them)
    const users = await sql`SELECT id FROM users LIMIT 1`;
    if (!users || users.length === 0) {
      console.log("❌ No users found in database");
      return;
    }
    const userId = users[0].id;
    console.log(`✓ Keeping user: ${userId}`);

    // Get first goal for this user (we'll keep it)
    const goals = await sql`SELECT id FROM goals WHERE user_id = ${userId} LIMIT 1`;
    const goalIds = goals.map((g) => g.id);
    console.log(`✓ Keeping goal${goals.length > 0 ? ": " + goals[0].id : "s: none"}`);

    // Get first group (we'll keep it)
    const groups = await sql`SELECT id FROM groups LIMIT 1`;
    const groupIds = groups.map((g) => g.id);
    console.log(`✓ Keeping group${groups.length > 0 ? ": " + groups[0].id : "s: none"}`);

    // Delete cascade by user records (keep only first user's data)
    console.log("\n🗑️  Deleting data for users except: " + userId);

    // Get all other user IDs
    const otherUsers = await sql`SELECT id FROM users WHERE id != ${userId}`;

    if (otherUsers.length > 0) {
      const otherUserIds = otherUsers.map((u) => u.id);
      // Delete users cascade (foreign keys will handle deletions)
      await sql`DELETE FROM users WHERE id != ${userId}`;
      console.log(`✓ Deleted ${otherUsers.length} users and their cascading data`);
    }

    // Delete goals except the one we're keeping
    console.log("\n🗑️  Deleting goals except: " + (goalIds[0] || "none"));
    if (goalIds.length > 0) {
      await sql`DELETE FROM goals WHERE user_id = ${userId} AND id != ${goalIds[0]}`;
      console.log(`✓ Deleted goals`);
    } else {
      await sql`DELETE FROM goals WHERE user_id = ${userId}`;
      console.log("✓ Deleted all goals for user");
    }

    // Delete groups except the one we're keeping
    console.log("\n🗑️  Deleting groups except: " + (groupIds[0] || "none"));
    if (groupIds.length > 0) {
      await sql`DELETE FROM groups WHERE id != ${groupIds[0]}`;
      console.log(`✓ Deleted groups`);
    } else {
      await sql`DELETE FROM groups`;
      console.log("✓ Deleted all groups");
    }

    // Clean up group-related data for remaining group
    if (groupIds.length > 0) {
      console.log("\n🗑️  Cleaning group-related data...");

      const deleteQueries = [
        { name: "group_members", query: sql`DELETE FROM group_members WHERE group_id != ${groupIds[0]}` },
        { name: "group_invites", query: sql`DELETE FROM group_invites WHERE group_id != ${groupIds[0]}` },
        { name: "group_join_requests", query: sql`DELETE FROM group_join_requests WHERE group_id != ${groupIds[0]}` },
        { name: "group_goal_items", query: sql`DELETE FROM group_goal_items WHERE group_id != ${groupIds[0]}` },
        { name: "group_goal_messages", query: sql`DELETE FROM group_goal_messages WHERE group_goal_id NOT IN (SELECT id FROM group_goals)` },
        { name: "group_goal_milestones", query: sql`DELETE FROM group_goal_milestones WHERE group_goal_id NOT IN (SELECT id FROM group_goals)` },
        { name: "group_goal_members", query: sql`DELETE FROM group_goal_members WHERE group_goal_id NOT IN (SELECT id FROM group_goals)` },
        { name: "group_goal_join_requests", query: sql`DELETE FROM group_goal_join_requests WHERE group_goal_id NOT IN (SELECT id FROM group_goals)` },
        { name: "group_goal_member_trackers", query: sql`DELETE FROM group_goal_member_trackers WHERE group_goal_id NOT IN (SELECT id FROM group_goals)` },
      ];

      for (const { name, query } of deleteQueries) {
        try {
          await query;
          console.log(`✓ Cleaned ${name}`);
        } catch (e) {
          console.log(`✓ Skipped ${name} (table not found)`);
        }
      }
    }

    // Clean up goal-related data for kept goal
    if (goalIds.length > 0) {
      console.log("\n🗑️  Cleaning goal-related data...");

      const deleteQueries = [
        { name: "goal_tasks", query: sql`DELETE FROM goal_tasks WHERE goal_id != ${goalIds[0]}` },
        { name: "progress_entries", query: sql`DELETE FROM progress_entries WHERE goal_id != ${goalIds[0]}` },
        { name: "goal_moments", query: sql`DELETE FROM goal_moments WHERE goal_id != ${goalIds[0]}` },
      ];

      for (const { name, query } of deleteQueries) {
        try {
          await query;
          console.log(`✓ Cleaned ${name}`);
        } catch (e) {
          console.log(`✓ Skipped ${name} (table not found)`);
        }
      }

      // Keep daily logs only for kept user
      try {
        await sql`DELETE FROM daily_logs WHERE user_id != ${userId}`;
        console.log("✓ Cleaned daily_logs");
      } catch (e) {
        console.log("✓ Skipped daily_logs (table not found)");
      }
    }

    // Clean up other user-specific tables
    console.log("\n🗑️  Cleaning user-specific data...");
    
    const userDeleteQueries = [
      { name: "connections", query: sql`DELETE FROM connections WHERE user_id != ${userId} AND friend_id != ${userId}` },
      { name: "friend_requests", query: sql`DELETE FROM friend_requests WHERE requester_id != ${userId} AND recipient_id != ${userId}` },
      { name: "achievements", query: sql`DELETE FROM achievements WHERE user_id != ${userId}` },
      { name: "notifications", query: sql`DELETE FROM notifications WHERE user_id != ${userId}` },
      { name: "circle_posts", query: sql`DELETE FROM circle_posts WHERE user_id != ${userId}` },
      { name: "circle_comments", query: sql`DELETE FROM circle_comments WHERE user_id != ${userId}` },
      { name: "circle_reactions", query: sql`DELETE FROM circle_reactions WHERE user_id != ${userId}` },
      { name: "ai_insights", query: sql`DELETE FROM ai_insights WHERE user_id != ${userId}` },
      { name: "badges", query: sql`DELETE FROM badges WHERE user_id != ${userId}` },
      { name: "wearable_data", query: sql`DELETE FROM wearable_data WHERE user_id != ${userId}` },
      { name: "wearable_integrations", query: sql`DELETE FROM wearable_integrations WHERE user_id != ${userId}` },
      { name: "challenges", query: sql`DELETE FROM challenges WHERE created_by != ${userId}` },
    ];

    for (const { name, query } of userDeleteQueries) {
      try {
        await query;
        console.log(`✓ Cleaned ${name}`);
      } catch (e) {
        console.log(`✓ Skipped ${name} (table not found)`);
      }
    }

    console.log("\n✅ Database reset complete!");
    console.log(`\n📋 Results:`);
    console.log(`  • Kept 1 user: ${userId}`);
    console.log(`  • Kept 1 goal: ${goalIds[0] || "none"}`);
    console.log(`  • Kept 1 group: ${groupIds[0] || "none"}`);

  } catch (error) {
    console.error("❌ Error during database reset:", error.message);
    throw error;
  }
}

resetDatabase();
