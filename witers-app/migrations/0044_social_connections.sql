-- Conexiones OAuth a Meta (Instagram/Facebook) para publicar piezas del
-- calendario directo desde Planificación. Un usuario conecta como máximo
-- una cuenta de Instagram y una Página de Facebook (UNIQUE(user_id, platform));
-- reconectar sobreescribe la fila existente. Tokens cifrados en reposo — ver
-- src/lib/token-crypto.server.ts.
CREATE TABLE social_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram')),
  external_id TEXT NOT NULL,
  external_name TEXT,
  page_id TEXT,
  access_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  connected_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, platform)
);

-- Puente de un solo uso entre el callback de OAuth y el selector de Página,
-- para cuando el usuario administra más de una Página de Facebook — mismo
-- patrón bearer-token que password_reset_tokens (migración 0028): el propio
-- id es el secreto.
CREATE TABLE social_connect_pending (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  pages_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Un registro por intento de publicar (éxito o error) — no se sobreescribe,
-- para conservar el historial si falla y se reintenta.
CREATE TABLE calendar_entry_publications (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES calendar_entries(id),
  platform TEXT NOT NULL CHECK(platform IN ('facebook','instagram')),
  status TEXT NOT NULL CHECK(status IN ('success','error')),
  external_post_id TEXT,
  error TEXT,
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_social_connections_user ON social_connections(user_id);
CREATE INDEX idx_calendar_entry_publications_entry ON calendar_entry_publications(entry_id);
