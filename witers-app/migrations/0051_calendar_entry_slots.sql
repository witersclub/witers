-- Plus members may plan two pieces on a single date. Existing plans are
-- intentionally slot 1, so this change never moves or replaces content.
ALTER TABLE calendar_entries ADD COLUMN slot_index INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_calendar_entries_user_date_slot
  ON calendar_entries(user_id, scheduled_date, slot_index);
