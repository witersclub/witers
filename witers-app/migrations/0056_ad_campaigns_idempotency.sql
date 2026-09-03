-- Replaces the old "no duplicate row in the last 2 minutes" heuristic
-- (a timing guess, not a real guarantee — two near-simultaneous requests
-- could both pass that check before either had written a row yet) with a
-- real, DB-enforced guard: the client generates one idempotency_key per
-- opened "Pautar" sheet, the server reserves a row under that key BEFORE
-- calling Meta at all, and a second request carrying the same key hits the
-- UNIQUE constraint and gets the first attempt's outcome back instead of
-- creating a second campaign.
--
-- status now also tracks partial/failed creation (see meta-ads-create
-- .server.ts) instead of every row always being 'paused' regardless of
-- what actually got created in Meta. error_message already existed
-- (added by an earlier migration) but was never actually written to —
-- this is the first migration that makes real use of it.
ALTER TABLE ad_campaigns ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX idx_ad_campaigns_idempotency_key ON ad_campaigns(idempotency_key);
