-- Company/product identity and per-piece creative brief, plus splitting the
-- old single "reference" upload into a dedicated logo and product photo so
-- clients (and designers reading the request) know exactly which is which.
-- reference_key stays untouched for requests submitted before this change.
ALTER TABLE design_requests ADD COLUMN company_name TEXT;
ALTER TABLE design_requests ADD COLUMN product_name TEXT;
ALTER TABLE design_requests ADD COLUMN piece_brief TEXT;
ALTER TABLE design_requests ADD COLUMN logo_key TEXT;
ALTER TABLE design_requests ADD COLUMN product_photo_key TEXT;
