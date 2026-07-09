-- Separate concrete facts (price/discount) from ad copy the client shouldn't
-- have to write themselves — required_text stays optional and the design
-- team composes the final wording when it's left blank.
ALTER TABLE design_requests ADD COLUMN promo_price TEXT;
