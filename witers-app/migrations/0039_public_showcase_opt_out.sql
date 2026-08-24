-- Per-account switch for the homepage's public showcases (the "Clientes
-- satisfechos" carousel, the reviews carousel, and the brand-logo wall —
-- see /api/public/showcase, /api/public/reviews, /api/public/brands).
-- Defaults to 1 (shown) so existing behavior doesn't change for anyone;
-- an admin unchecks it per account from the Usuarios panel to keep a
-- specific client's (or a staff test account's) work off the public site.
ALTER TABLE users ADD COLUMN public_showcase INTEGER NOT NULL DEFAULT 1;
