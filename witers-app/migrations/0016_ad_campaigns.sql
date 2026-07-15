-- Tracks the Meta campaign/ad set/ad created for a finished design request
-- via "Quiero pautar" — Meta's own API has no idea these belong to a
-- WITERS request, so this is the mapping. Always created with status
-- 'paused': nothing goes live/spends money until the client (or staff)
-- explicitly activates it from the panel.
CREATE TABLE ad_campaigns (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES design_requests(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  meta_campaign_id TEXT NOT NULL,
  meta_adset_id TEXT NOT NULL,
  meta_ad_id TEXT,
  objective TEXT NOT NULL,
  daily_budget_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused', -- paused | active | error
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ad_campaigns_user ON ad_campaigns(user_id);
CREATE INDEX idx_ad_campaigns_request ON ad_campaigns(request_id);
