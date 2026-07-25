-- A real Meta campaign can now be added to as many clients' panels as staff
-- choose (team members / shared ad accounts sharing visibility is normal,
-- not a special case) — this replaces the "one client per campaign" rule
-- from migration 0024 and its admin-only-preview exception from migration
-- 0025. The only invariant left is not linking the same campaign into the
-- same client's panel twice.
--
-- staff_preview (added in 0025) is no longer read anywhere; left in place
-- rather than risk a column-drop migration for no functional gain.

DROP INDEX IF EXISTS idx_ad_campaigns_meta_campaign;

CREATE UNIQUE INDEX idx_ad_campaigns_user_campaign
  ON ad_campaigns(user_id, meta_campaign_id);
