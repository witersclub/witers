-- Session duration for the admin "Indicadores" tab — how long each
-- visitor has actually been on the site (see /api/visitor-heartbeat),
-- not just when they first ever showed up. A "session" resets after a
-- 30-minute gap with no heartbeat, same boundary Google Analytics uses,
-- so a visitor who leaves and comes back next week doesn't read as a
-- multi-day session. Existing rows get their created_at as a best-effort
-- starting point.
ALTER TABLE visitor_heartbeats ADD COLUMN session_started_at TEXT;

UPDATE visitor_heartbeats SET session_started_at = created_at WHERE session_started_at IS NULL;
