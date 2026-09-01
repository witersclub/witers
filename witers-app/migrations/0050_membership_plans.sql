-- Replace retired self-service tiers with the two administrator-only plans.
-- Payments stay disabled in application code; this only keeps active
-- memberships and Wit capacity aligned with the new internal catalog.
UPDATE memberships
SET
  plan = CASE WHEN plan = 'scale' THEN 'plus' ELSE 'mensual' END,
  price_mxn = CASE WHEN plan = 'scale' THEN 899 ELSE 599 END,
  requests_quota = CASE WHEN plan = 'scale' THEN 40 ELSE 20 END,
  video_requests_quota = CASE WHEN plan = 'scale' THEN 10 ELSE 5 END,
  carousel_requests_quota = CASE WHEN plan = 'scale' THEN 10 ELSE 5 END
WHERE plan IN ('essential', 'grow', 'scale');
