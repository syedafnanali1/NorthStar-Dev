-- Migration: 0003_add_user_phone_number
-- Adds missing phone_number column to users table

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone_number" TEXT;
