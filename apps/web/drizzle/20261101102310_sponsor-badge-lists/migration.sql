-- Hand-written (`drizzle-kit generate --custom`): a sponsor now keeps an ordered list of badges, so each
-- stored badge object becomes a one-badge list.
UPDATE "perk_claim" SET "config" = json_build_array("config")
WHERE "perk_id" = 'custom-badge' AND json_typeof("config") = 'object';
