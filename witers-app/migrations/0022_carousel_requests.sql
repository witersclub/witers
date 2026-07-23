-- "Carruseles para redes sociales" (see src/lib/membership-plans.ts —
-- Crecimiento/Élite already sell "2/4 carruseles", never had a backend).
-- A carousel request is 4 ordered slides sharing one aspect_ratio and one
-- brand context, so it gets its own parent row plus a 1:4 child table
-- (slide_index 1-4) instead of 4 independent design_requests — the client
-- reviews/tracks them as one unit, but each slide has its own brief and
-- can be delivered, and revised, independently.
CREATE TABLE carousel_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'nueva', -- nueva | en_proceso | completada | rechazada
  title TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  company_name TEXT,
  brand_colors TEXT,
  logo_key TEXT,
  claimed_by TEXT REFERENCES users(id),
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_carousel_requests_user ON carousel_requests(user_id);
CREATE INDEX idx_carousel_requests_claimed ON carousel_requests(claimed_by);

CREATE TABLE carousel_slides (
  id TEXT PRIMARY KEY,
  carousel_request_id TEXT NOT NULL REFERENCES carousel_requests(id),
  slide_index INTEGER NOT NULL, -- 1-4
  title TEXT NOT NULL DEFAULT '', -- título corto de esta lámina, redactado por Wit
  brief TEXT NOT NULL, -- brief propio de esta lámina, redactado por Wit
  delivered_key TEXT, -- R2 key de la lámina entregada
  delivered_at TEXT,
  change_request_note TEXT, -- pedido de cambio puntual de esta lámina
  change_requested_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_carousel_slides_request_index ON carousel_slides(carousel_request_id, slide_index);

-- Own pool, independent from requests_quota/requests_used (imágenes) and
-- video_requests_quota/video_requests_used — a member's monthly carousel
-- allowance is a separate line item per membership-plans.ts.
ALTER TABLE memberships ADD COLUMN carousel_requests_quota INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memberships ADD COLUMN carousel_requests_used INTEGER NOT NULL DEFAULT 0;
