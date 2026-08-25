-- Structured 4-slide breakdown for carrusel calendar entries, decided once
-- by Wit at calendar-planning time (see wit-chat.server.ts's
-- runWitCalendarChat / CALENDAR_TOOLS) so what the client reviews in the
-- plan is exactly what later gets submitted to createCarouselRequest — no
-- second AI call at request-time, no risk of drift. NULL for imagen/video
-- entries.
ALTER TABLE calendar_entries ADD COLUMN slides_json TEXT;
