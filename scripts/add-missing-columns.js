#!/usr/bin/env node
/**
 * Add missing columns to production database
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function addMissingColumns() {
  console.log("🔧 Adding missing columns to production database...\n");

  try {
    // Add columns to users table
    console.log("📋 Checking users table...");
    try {
      await sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS date_of_birth timestamp,
        ADD COLUMN IF NOT EXISTS is_perseverance boolean DEFAULT false NOT NULL
      `;
      console.log("✓ Added missing columns to users table");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("✓ Columns already exist in users table");
      } else {
        throw e;
      }
    }

    // Add columns to goals table
    console.log("📋 Checking goals table...");
    try {
      await sql`
        ALTER TABLE goals 
        ADD COLUMN IF NOT EXISTS group_goal_item_id text
      `;
      console.log("✓ Added missing columns to goals table");
    } catch (e) {
      if (e.message.includes("already exists")) {
        console.log("✓ Columns already exist in goals table");
      } else {
        throw e;
      }
    }

    console.log("\n✅ Column migration complete!");

  } catch (error) {
    console.error("❌ Error during migration:", error.message);
    throw error;
  }
}

addMissingColumns();
