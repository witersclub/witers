-- The client's usual WhatsApp destination for "Pautar" campaigns — Meta's
-- display-formatted number (e.g. "+52 55 1234 5678"), digits stripped at
-- send time the same way the existing wa.me link already does. Nullable:
-- most clients haven't picked one yet, and the wizard always lets them
-- choose a different number for a specific campaign regardless of this
-- default.
ALTER TABLE brand_profiles ADD COLUMN default_whatsapp_number TEXT;
