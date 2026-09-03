// Single source of truth for the Graph API version used by every Meta
// integration in this project (ad creation, the ad-account OAuth connect
// flow, the Page-publish OAuth flow, and the read-only campaign dashboard).
// Was previously hardcoded independently as "v21.0" in all four of those
// files — that version is retired 2027-01-21 (Meta gives each version a
// fixed two-year window from release), so there wasn't much runway left.
// v22.0 has years of support ahead of it and needs no other code changes
// here — it's a drop-in version bump, not a new API generation.
export const META_GRAPH_VERSION = "v22.0";
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
