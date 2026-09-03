-- The client-facing quota moves from three separate per-format caps
-- (imagen/video/carrusel) to one shared monthly pool, freely split across
-- formats — see membership-plans.ts. requests_quota/requests_used now
-- represent the account's TOTAL for the month, not just images.
--
-- Fold each membership's already-used video/carousel requests into the
-- shared counter so month-to-date usage carries over instead of resetting,
-- and resync requests_quota to the new aggregate (30 Mensual / 60 Plus).
--
-- video_requests_quota/carousel_requests_quota/video_requests_used/
-- carousel_requests_used are zeroed and no longer read by application
-- code. They are kept as columns rather than dropped — this project has
-- no established DROP COLUMN precedent and dropping isn't required to
-- retire their meaning.
UPDATE memberships
SET
  requests_used = requests_used + video_requests_used + carousel_requests_used,
  requests_quota = CASE WHEN plan = 'plus' THEN 60 ELSE 30 END,
  video_requests_used = 0,
  carousel_requests_used = 0,
  video_requests_quota = 0,
  carousel_requests_quota = 0
WHERE plan IN ('mensual', 'plus');
