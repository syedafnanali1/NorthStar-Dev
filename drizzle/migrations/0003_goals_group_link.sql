-- Migration: Link personal goals to group goal items
-- When a member adds a group goal to their calendar, a personal goal is created

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS group_goal_item_id text,
  ADD COLUMN IF NOT EXISTS group_id text;

CREATE INDEX IF NOT EXISTS goals_group_goal_item_id_idx ON goals (group_goal_item_id);
