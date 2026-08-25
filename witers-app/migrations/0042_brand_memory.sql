-- "Memoria inferida": a compact, evolving summary of what Wit has learned
-- about a specific brand from real signals (a design rejected by staff, a
-- change requested by the client on a delivered piece) — never asked
-- directly. One row per user; each new signal is merged/summarized into
-- the existing notes by a best-effort OpenAI call (see
-- brand-memory.server.ts's recordBrandSignal), not appended forever, so
-- this stays bounded instead of growing without limit.
CREATE TABLE brand_memory (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
