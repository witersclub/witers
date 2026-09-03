-- Reusable audiences for "Pautar" — built once (by Wit or by hand in the
-- Audiencia step), saved, and offered again on the next campaign instead
-- of describing the same audience twice. Everything here is already
-- resolved against Meta's real search (location_key/interests_json come
-- straight from searchMetaLocations/searchMetaInterests) — nothing here
-- is re-interpreted by AI when reused, only when first created.
CREATE TABLE saved_audiences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  age_min INTEGER NOT NULL,
  age_max INTEGER NOT NULL,
  location_key TEXT,
  location_label TEXT,
  radius_km INTEGER,
  -- JSON array of {id, name} — the real Meta interest ids already
  -- resolved when this audience was built, never re-resolved on reuse.
  interests_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_saved_audiences_user ON saved_audiences(user_id);
