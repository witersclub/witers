-- Structured brief fields for design_requests, added to replace the single
-- free-text "brief" catch-all with guided fields (audience, age range,
-- required copy, brand colors) that clients fill faster and admins can read
-- at a glance / feed straight into the AI prompt builder.
ALTER TABLE design_requests ADD COLUMN audience TEXT;
ALTER TABLE design_requests ADD COLUMN age_range TEXT;
ALTER TABLE design_requests ADD COLUMN required_text TEXT;
ALTER TABLE design_requests ADD COLUMN brand_colors TEXT;
