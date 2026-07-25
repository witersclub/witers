-- "Olvidé mi contraseña" — single-use, short-lived tokens, same bearer-token
-- pattern as `sessions` (the id itself is the secret, not hashed) since
-- these are already short-lived and single-use.
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
