-- Up to 2 revision requests per delivered piece. Requesting one does NOT
-- consume the client's request quota, and flips the request back to
-- 'en_proceso' so it reappears for the design team.
ALTER TABLE design_requests ADD COLUMN revisions_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE design_requests ADD COLUMN revision_note_1 TEXT;
ALTER TABLE design_requests ADD COLUMN revision_note_2 TEXT;
