-- Files the client deliberately adds as source material for Wit. They stay
-- separate from a request's attachments, so they can inform future planning
-- without becoming part of a single production request.
CREATE TABLE brand_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'reference',
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  use_in_planning INTEGER NOT NULL DEFAULT 1,
  text_content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_brand_assets_user_created ON brand_assets(user_id, created_at DESC);
