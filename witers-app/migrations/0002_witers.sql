-- WITERS platform schema. Additive only (shared preview/prod database).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | canceled
  plan TEXT NOT NULL DEFAULT 'premium',
  price_mxn INTEGER NOT NULL DEFAULT 599,
  requests_quota INTEGER NOT NULL DEFAULT 50,
  requests_used INTEGER NOT NULL DEFAULT 0,
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  membership_id TEXT REFERENCES memberships(id),
  amount_mxn INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'card',
  provider TEXT NOT NULL DEFAULT 'sandbox', -- sandbox | stripe | mercadopago
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'paid', -- paid | pending | failed | refunded
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS design_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  style TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  reference_key TEXT, -- R2 object key of optional uploaded reference
  status TEXT NOT NULL DEFAULT 'en_proceso', -- en_proceso | completada | rechazada
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS request_results (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES design_requests(id),
  kind TEXT NOT NULL DEFAULT 'generated', -- generated | uploaded
  r2_key TEXT,           -- for uploaded deliverables
  image_url TEXT,        -- for AI-generated deliverables (CDN url)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_user ON design_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_results_request ON request_results(request_id);
