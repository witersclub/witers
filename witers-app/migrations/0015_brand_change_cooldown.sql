-- Timestamps for the last deliberate logo/colors change made from the
-- panel's "Activos de marca" section — separate from the general
-- updated_at, which also moves for reasons that aren't a real brand
-- change (e.g. resolveBrandProfile filling in a logo left empty at
-- onboarding). Null until the member's first deliberate edit; a 30-day
-- cooldown between changes is enforced in code using these.
ALTER TABLE brand_profiles ADD COLUMN logo_updated_at TEXT;
ALTER TABLE brand_profiles ADD COLUMN colors_updated_at TEXT;
