-- "Sign in with Google" as an alternative to email/password — same users
-- table, matched by email either way. google_id (the account's stable
-- Google "sub" claim) is kept for reference but isn't required for lookups;
-- email is normalized/unique already and is what actually links a Google
-- sign-in to an existing password-based account.
ALTER TABLE users ADD COLUMN google_id TEXT;
