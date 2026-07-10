-- Designer claim system: a designer must claim a request before acting on
-- it, so two people don't work the same job. NULL claimed_by = unclaimed.
ALTER TABLE design_requests ADD COLUMN claimed_by TEXT REFERENCES users(id);
ALTER TABLE design_requests ADD COLUMN claimed_at TEXT;
