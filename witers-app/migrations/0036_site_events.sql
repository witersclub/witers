-- Lightweight event log for the admin "Indicadores" tab (formerly "En
-- vivo") — one row per meaningful click, not a full analytics pipeline.
-- Currently only 'whatsapp_click' is logged (see /api/track-event and the
-- WhatsAppFloatButton), but `type` is free text so future indicators
-- (e.g. "Hablar con una persona" clicks) can reuse this same table
-- instead of each needing their own.
CREATE TABLE site_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  visitor_id TEXT,
  user_id TEXT REFERENCES users(id),
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_site_events_type_created ON site_events(type, created_at);
