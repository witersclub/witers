-- One-time "paquetes de imágenes" add-on (see src/lib/image-packs.ts): extra
-- solicitudes a member can buy on top of their monthly quota, stacking with
-- any active plan and never expiring. bonus_requests_quota is the effective
-- ceiling added to requests_quota when checking remaining balance (see
-- /api/requests.ts and /api/purchase-pack). pack_id/pack_images on payments
-- distinguish a pack purchase from a plan payment for reporting.
ALTER TABLE memberships ADD COLUMN bonus_requests_quota INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN pack_id TEXT;
ALTER TABLE payments ADD COLUMN pack_images INTEGER;
