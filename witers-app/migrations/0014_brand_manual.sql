-- Brand manual (guidelines document) a member can upload for themselves in
-- the panel's "Activos de marca" section — separate from logo_key, which
-- the mandatory onboarding chat already collects. Nullable: most members
-- won't have one on day one.
ALTER TABLE brand_profiles ADD COLUMN brand_manual_key TEXT;
