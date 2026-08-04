-- A client without their own font files can instead pick one from the
-- built-in Google Fonts library (see google-font-picker.tsx) — this stores
-- the chosen family name (e.g. "Playfair Display"), never a file. Mutually
-- exclusive with font_keys in practice (setBrandFont clears the other one
-- whenever either is set), but not DB-enforced since neither column is
-- required.
ALTER TABLE brand_profiles ADD COLUMN library_font TEXT;
