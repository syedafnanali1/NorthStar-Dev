#!/usr/bin/env node
/**
 * Direct database migration runner (CommonJS version)
 * Connects to Neon and applies SQL migrations for missing columns
 */
const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function runMigration() {
  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected');

    // SQL to add missing columns
    const migrations = [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;`,
      `ALTER TABLE "moments" ADD COLUMN IF NOT EXISTS "is_perseverance" BOOLEAN NOT NULL DEFAULT false;`
    ];

    for (const sql of migrations) {
      console.log(`\n⏳ Running: ${sql.split(';')[0].substring(0, 50)}...`);
      await client.query(sql);
      console.log('✅ Done');
    }

    // Verify columns exist
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'phone_number'
      ) AS phone_number_exists,
      EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'moments' AND column_name = 'is_perseverance'
      ) AS is_perseverance_exists;
    `);

    const { phone_number_exists, is_perseverance_exists } = result.rows[0];
    
    console.log('\n📊 Migration Verification:');
    console.log(`  phone_number column: ${phone_number_exists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  is_perseverance column: ${is_perseverance_exists ? '✅ EXISTS' : '❌ MISSING'}`);

    if (phone_number_exists && is_perseverance_exists) {
      console.log('\n✅ All migrations completed successfully!');
      process.exit(0);
    } else {
      console.error('\n❌ Migration verification failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
