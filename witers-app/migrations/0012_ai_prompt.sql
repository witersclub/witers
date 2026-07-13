-- Replaces the earlier AI-image-generation drafts with a text-only use of
-- the OpenAI API: whenever a request comes in, its locally-built prompt
-- gets run through a chat completion to fix spelling and tighten wording
-- into something professional, and the result is stashed here for staff to
-- copy straight into whatever design tool they're using. NULL until that
-- background call finishes (or if it fails) — callers fall back to the
-- locally-built prompt in that case.
ALTER TABLE design_requests ADD COLUMN ai_prompt TEXT;
