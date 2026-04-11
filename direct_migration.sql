-- Run this directly against the Neon production database
-- To apply missing columns to production schema

-- Add phone_number column if it doesn't exist
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone_number" TEXT;

-- Add is_perseverance column if it doesn't exist  
ALTER TABLE "moments"
  ADD COLUMN IF NOT EXISTS "is_perseverance" BOOLEAN NOT NULL DEFAULT false;

-- Verify columns were added
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'phone_number'
) AS phone_number_exists,
EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'moments' AND column_name = 'is_perseverance'
) AS is_perseverance_exists;
