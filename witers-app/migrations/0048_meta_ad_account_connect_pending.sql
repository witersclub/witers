-- Temporary account choices produced by the advertising OAuth callback.
CREATE TABLE meta_ad_account_connect_pending (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  accounts_json TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meta_ad_account_connect_pending_user
ON meta_ad_account_connect_pending(user_id);

-- OAuth authorization used only by server-side Meta Marketing API calls.
-- Tokens are AES-GCM encrypted with TOKEN_ENCRYPTION_KEY, never returned by
-- /api/brand-profile or exposed to the browser.
CREATE TABLE meta_ad_account_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  ad_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
