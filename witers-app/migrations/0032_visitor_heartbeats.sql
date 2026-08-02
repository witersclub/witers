-- Live-visitor tracking ("who's on the site right now" — see
-- /api/visitor-heartbeat and /api/admin/live-visitors), same spirit as
-- Wix's live view. One row per browser (an anonymous wit_visitor cookie,
-- set for every visitor whether logged in or not), upserted on every
-- heartbeat instead of accumulating a row per ping — table growth is
-- bounded by distinct visitors, not by requests. When a session also
-- exists, user_id/user_name/user_role get filled in too; anonymous
-- visitors just leave those null.
CREATE TABLE visitor_heartbeats (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  user_role TEXT,
  path TEXT NOT NULL,
  country TEXT,
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_visitor_heartbeats_last_seen ON visitor_heartbeats(last_seen);
