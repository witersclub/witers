-- "Sign in with Facebook" as another alternative to email/password, same
-- pattern as 0027_google_signin.sql: same users table, matched by email
-- either way. facebook_id (the account's stable Facebook user id) is kept
-- for reference but isn't required for lookups; email is what actually
-- links a Facebook sign-in to an existing account.
ALTER TABLE users ADD COLUMN facebook_id TEXT;
