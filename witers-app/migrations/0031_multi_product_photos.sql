-- Multiple reference/product photos per request, not just one — the old
-- single product_photo_key column silently got overwritten every time a
-- client attached a second photo through Wit, so only the last one ever
-- reached the designer. Stored as a JSON array of R2 keys. product_photo_key
-- stays untouched (old rows keep reading from it); new submissions write
-- here instead (see requests.ts).
ALTER TABLE design_requests ADD COLUMN product_photo_keys TEXT;
