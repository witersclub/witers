-- Client-reported error on a piece already marked 'cerrada' (finalized).
-- Unlike revision_note_1/2 (free revisions during 'completada', no gate),
-- this requires admin approval before the request reopens for the design
-- team, since the client already confirmed the piece once. See
-- /api/request-change and /api/admin/activate-change.
ALTER TABLE design_requests ADD COLUMN change_request_note TEXT;
ALTER TABLE design_requests ADD COLUMN change_requested_at TEXT;
