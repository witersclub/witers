-- Video publication is asynchronous in Meta. Keep its state separately from
-- the original image/carousel publication history so cron can resume it after
-- the browser request ends or the client closes the page.
CREATE TABLE calendar_entry_video_publications (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES calendar_entries(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram')),
  processing_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processing','success','error')),
  external_post_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX idx_calendar_video_publications_pending
  ON calendar_entry_video_publications(status, created_at);
CREATE INDEX idx_calendar_video_publications_entry
  ON calendar_entry_video_publications(entry_id, created_at);
