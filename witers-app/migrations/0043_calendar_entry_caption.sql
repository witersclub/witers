-- Suggested social copy for a calendar entry, generated on demand the
-- first time the client opens that piece (see /api/calendar-entries-caption)
-- and cached here so reopening the same piece doesn't regenerate it.
ALTER TABLE calendar_entries ADD COLUMN caption TEXT;
