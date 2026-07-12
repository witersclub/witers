-- One row per member, locking their brand identity (company name, brand
-- colors, business category, logo) to whatever they submit first — a
-- membership is meant to serve one business, not be shared across several.
-- logo_key stays NULL until a request actually includes a real logo (not
-- the "no logo" case), at which point it locks in place too.
CREATE TABLE brand_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  company_name TEXT NOT NULL,
  brand_colors TEXT,
  business_type TEXT,
  logo_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
