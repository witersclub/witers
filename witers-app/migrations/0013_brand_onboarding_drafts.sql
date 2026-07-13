-- Resumable partial answers for the mandatory brand-onboarding chat that
-- runs the first time a member reaches their panel (before brand_profiles
-- exists). One row per user, overwritten on every answer so a client who
-- abandons partway through and comes back later (same or different
-- device) picks up exactly where they left off. Deleted once onboarding
-- completes and the real brand_profiles row is written.
CREATE TABLE brand_onboarding_drafts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  answers TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
