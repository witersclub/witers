-- Optional brand typography files, collected once during the mandatory
-- brand-onboarding chat (see panel.tsx's OnboardingGate) — comma-joined R2
-- keys, same pattern as design_requests.product_photo_keys. Freely
-- overwritable (no lock like logo_key) since a font isn't part of the
-- account-identity guarantee resolveBrandProfile enforces, just a nice-to-
-- have asset for designers.
ALTER TABLE brand_profiles ADD COLUMN font_keys TEXT;
