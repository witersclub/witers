-- Lets an admin add a real campaign to their OWN panel as a preview even
-- when that same campaign is already linked to a real client — useful when
-- staff test accounts share an ad account with a real client's. The
-- meta_campaign_id uniqueness rule (one real client per campaign) still
-- holds; it just no longer counts staff preview rows.

ALTER TABLE ad_campaigns ADD COLUMN staff_preview INTEGER NOT NULL DEFAULT 0;

DROP INDEX idx_ad_campaigns_meta_campaign;

CREATE UNIQUE INDEX idx_ad_campaigns_meta_campaign
  ON ad_campaigns(meta_campaign_id)
  WHERE staff_preview = 0;
