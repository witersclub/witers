-- Blocks login until a client confirms they actually own the email they
-- typed — catches typos that pure format validation can't (e.g.
-- "nombre@gmail.comcontadora": syntactically a valid-looking email, real
-- TLDs are just as long, so no format rule can tell it apart from a real
-- one). Defaults to 1 so every existing account is grandfathered in —
-- nobody currently active gets locked out by this migration. Only
-- register.ts (the public self-signup form) explicitly sets this to 0;
-- Google/Facebook signups and admin-created designer accounts all rely on
-- this same default of 1, since those providers/the admin already vouch
-- for the address.
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;

-- Same bearer-token pattern as password_reset_tokens (0028) — the id
-- itself is the secret, single-use, short-lived.
CREATE TABLE email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_email_verification_tokens_user ON email_verification_tokens(user_id);
