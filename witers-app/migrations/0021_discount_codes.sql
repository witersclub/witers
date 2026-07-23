-- Admin-managed discount codes for the Stripe checkout (percent off the
-- IVA-inclusive charge). uses_count is incremented only once a payment
-- actually succeeds (see /api/checkout), never at creation or on a merely
-- validated/attempted checkout, so max_uses tracks real redemptions.
CREATE TABLE discount_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_percent REAL NOT NULL, -- 0.1–100
  max_uses INTEGER, -- NULL = unlimited
  uses_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT, -- NULL = never expires
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_discount_codes_code ON discount_codes(code);

-- Which code (if any) a payment used, and at what percent — kept on the
-- payment row itself so a later change to the code's percent/status never
-- rewrites history.
ALTER TABLE payments ADD COLUMN discount_code TEXT;
ALTER TABLE payments ADD COLUMN discount_percent REAL;
