-- video_requests never had a "pedir cambio" flow (imagen has revision/change,
-- carrusel has change_request_note per lámina) — a delivered video just sat
-- there with no way to ask for an adjustment. Mirrors carousel_slides'
-- change_request_note: the client's note reopens the request straight to
-- 'en_proceso' (no admin approval gate, same as carousel), no revision cap.
ALTER TABLE video_requests ADD COLUMN change_request_note TEXT;
ALTER TABLE video_requests ADD COLUMN change_requested_at TEXT;
