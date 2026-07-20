-- "Solicitudes de video" (see src/lib/membership-plans.ts — Grow/Scale
-- already sell "2/4 videos para redes sociales", never had a backend).
-- Own table, not columns on design_requests, same call as ad_campaigns
-- (0016): a video request has its own shape (raw footage from the client,
-- optional AI-scene notes, a single delivered cut) and its own lifecycle,
-- not a piece variant. Client-uploaded raw footage is 1:many per request
-- (they can send several clips for one edit), hence the child table.
CREATE TABLE video_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'nueva', -- nueva | en_proceso | completada | rechazada
  title TEXT NOT NULL,
  purpose TEXT NOT NULL, -- qué se quiere lograr con el video
  platform TEXT NOT NULL, -- instagram | tiktok | youtube | facebook | otro
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  duration_target TEXT, -- duración deseada, texto libre ("15-30 seg")
  tone TEXT, -- tono/estilo deseado
  music_mood TEXT, -- referencia de música/ambiente
  wants_ai_scenes INTEGER NOT NULL DEFAULT 0, -- 1 si pide escenas generadas con IA
  ai_scenes_note TEXT, -- qué escenas/momentos quiere resueltos con IA
  admin_note TEXT,
  claimed_by TEXT REFERENCES users(id),
  claimed_at TEXT,
  delivered_key TEXT, -- R2 key del corte final entregado
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_video_requests_user ON video_requests(user_id);
CREATE INDEX idx_video_requests_claimed ON video_requests(claimed_by);

CREATE TABLE video_request_raw_files (
  id TEXT PRIMARY KEY,
  -- Nullable: raw footage uploads to R2 (and gets its row here) as soon as
  -- the client picks a file, before the wizard's final step creates the
  -- video_requests row — the same "upload now, link at submit" order the
  -- image flow uses for logo_key/reference_key. /api/video-requests fills
  -- this in when the request is created.
  video_request_id TEXT REFERENCES video_requests(id),
  r2_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_video_raw_files_request ON video_request_raw_files(video_request_id);

-- Separate quota from requests_quota/requests_used (image solicitudes) —
-- a member's "15 solicitudes de diseño" and "2 videos" are independent
-- monthly allowances per membership-plans.ts, not the same pool.
ALTER TABLE memberships ADD COLUMN video_requests_quota INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memberships ADD COLUMN video_requests_used INTEGER NOT NULL DEFAULT 0;
