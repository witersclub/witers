-- The panel's help chat (client-facing button next to LanguageToggle) — an
-- AI-answered conversation that a client can escalate to a real staff
-- member at any point. One row per conversation; a client's most recent
-- non-"resuelta" conversation is reused across sessions (see
-- help-chat.server.ts) instead of always starting fresh, so closing the
-- chat and reopening it later picks up where they left off.
CREATE TABLE help_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ia', -- ia | escalada | resuelta
  -- Set the first time a staff member replies — same "who's handling this"
  -- pattern as design_requests.claimed_by, but auto-claimed by whoever
  -- replies first rather than needing its own explicit "reclamar" action.
  claimed_by TEXT REFERENCES users(id),
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_help_conversations_user ON help_conversations(user_id);
CREATE INDEX idx_help_conversations_status ON help_conversations(status);

CREATE TABLE help_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES help_conversations(id),
  role TEXT NOT NULL, -- user | assistant | staff
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_help_messages_conversation ON help_messages(conversation_id, created_at);
