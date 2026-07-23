-- Single-row cache of exchange rates (base MXN) used to show an
-- approximate price in the visitor's own currency on the membership
-- cards (see src/lib/fx-rates.server.ts, /api/geo-price). Refetched once
-- a day at most — never on every page view — so this is a cache, not a
-- log: one row, upserted in place (id is always 1).
CREATE TABLE fx_rates_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rates_json TEXT NOT NULL, -- { "USD": 0.058, "EUR": 0.054, "COP": 230.1, ... } — units per 1 MXN
  fetched_at TEXT NOT NULL
);
