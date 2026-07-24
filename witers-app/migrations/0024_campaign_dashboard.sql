-- Replaces the self-serve "Pauta interactiva" wizard with a staff-curated,
-- read-only campaign dashboard: WITERS gets added as a partner on the
-- client's own Meta ad account (their Business Manager, not ours), staff
-- picks which of that account's real campaigns show up in the client's
-- panel, and the panel just displays live Meta data for the ones chosen.

-- Per-client Meta ad account (their own — WITERS is a partner on it, not
-- the owner), same admin-only-set pattern as brand_profiles.meta_page_id.
-- Numeric, WITHOUT the "act_" prefix (added at call time, same convention
-- meta-ads.server.ts already uses for the old shared account).
ALTER TABLE brand_profiles ADD COLUMN meta_ad_account_id TEXT;

-- ad_campaigns used to be written only by the wizard (one row per request,
-- request_id/meta_adset_id/objective/daily_budget_cents always known at
-- creation time). Now a row can also be a manual link staff creates from a
-- live campaign list — no request, no locally-known budget/adset/objective,
-- since all of that is fetched live from Meta instead of cached here. SQLite
-- has no ALTER COLUMN, so the table is rebuilt with those columns relaxed to
-- nullable; existing wizard-created rows carry over unchanged.
ALTER TABLE ad_campaigns RENAME TO ad_campaigns_old;

CREATE TABLE ad_campaigns (
  id TEXT PRIMARY KEY,
  request_id TEXT REFERENCES design_requests(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  meta_campaign_id TEXT NOT NULL,
  meta_adset_id TEXT,
  meta_ad_id TEXT,
  objective TEXT,
  daily_budget_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'paused',
  error_message TEXT,
  -- The admin who linked this campaign to the client's dashboard; NULL for
  -- old wizard-created rows (the client created those themselves).
  linked_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO ad_campaigns
  (id, request_id, user_id, meta_campaign_id, meta_adset_id, meta_ad_id,
   objective, daily_budget_cents, status, error_message, created_at, updated_at)
SELECT
  id, request_id, user_id, meta_campaign_id, meta_adset_id, meta_ad_id,
  objective, daily_budget_cents, status, error_message, created_at, updated_at
FROM ad_campaigns_old;

DROP TABLE ad_campaigns_old;

CREATE INDEX idx_ad_campaigns_user ON ad_campaigns(user_id);
CREATE INDEX idx_ad_campaigns_request ON ad_campaigns(request_id);
-- A campaign can only be linked into one client's dashboard once — the
-- admin "add" screen relies on this to know a campaign is already linked.
CREATE UNIQUE INDEX idx_ad_campaigns_meta_campaign ON ad_campaigns(meta_campaign_id);
