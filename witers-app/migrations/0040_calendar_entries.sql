-- One row per planned piece of content on the "Planificación" monthly
-- calendar (see panel.tsx's PlanificacionPanel) — proposed by Wit in one
-- conversation (see wit-chat.server.ts's runWitCalendarChat /
-- submit_content_calendar), then confirmed by the client before landing
-- here. `request_id` stays NULL until the client taps "Pedir esta pieza";
-- it then points into design_requests, video_requests, or carousel_requests
-- depending on `format` — no FK constraint since the target table varies
-- (same polymorphic-by-convention pattern already used elsewhere in this
-- schema), resolved server-side in /api/calendar-entries.
CREATE TABLE calendar_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  scheduled_date TEXT NOT NULL, -- YYYY-MM-DD
  format TEXT NOT NULL, -- imagen | video | carrusel
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_calendar_entries_user_month ON calendar_entries(user_id, scheduled_date);
