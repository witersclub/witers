-- Persistent delivery jobs for calendar content. A calendar piece has one
-- current schedule; updating it replaces the pending execution instead of
-- leaving stale jobs behind. All timestamps are UTC ISO text.
CREATE TABLE calendar_entry_schedules (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL UNIQUE REFERENCES calendar_entries(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  scheduled_for_utc TEXT NOT NULL,
  timezone TEXT NOT NULL,
  platforms_json TEXT NOT NULL,
  connection_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('scheduled','publishing','published','partial','error','canceled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  next_attempt_at TEXT,
  last_error TEXT,
  published_at TEXT,
  results_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_calendar_entry_schedules_due
  ON calendar_entry_schedules(status, next_attempt_at, scheduled_for_utc);
CREATE INDEX idx_calendar_entry_schedules_user
  ON calendar_entry_schedules(user_id, status);
