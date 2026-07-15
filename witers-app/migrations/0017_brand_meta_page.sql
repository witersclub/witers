-- Per-client Facebook Page for Meta Ads (see meta-ads.server.ts). Unlike
-- the ad account (shared, one for all of WITERS), each client's ads must
-- come from their own connected Page — set here by an admin once that
-- Page has been manually added as a partner to WITERS's Business Manager.
-- "Quiero pautar" stays blocked for a client until this is set; there is
-- no shared/default Page fallback.
ALTER TABLE brand_profiles ADD COLUMN meta_page_id TEXT;
