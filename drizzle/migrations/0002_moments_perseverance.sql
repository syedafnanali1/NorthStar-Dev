-- Migration: Add isPerseverance flag to moments table
-- Tracks when a user explicitly marks a moment as one where they pushed through resistance

ALTER TABLE moments
  ADD COLUMN IF NOT EXISTS is_perseverance boolean NOT NULL DEFAULT false;
