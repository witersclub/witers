-- Human-readable label for a click event (e.g. "Quiero pautar mis
-- campañas"), so the admin "Indicadores" panel can list top clicks by
-- button, not just by generic type. NULL for event types that don't need
-- one (e.g. whatsapp_click, page_view).
ALTER TABLE site_events ADD COLUMN label TEXT;
