-- The client's numbering restarted at 1.0.0, and every client meets a 2.x or 3.x `unbound.min` from before
-- (`minimumClientVersion`), so those versions serve to any client.
UPDATE "addon_version" SET "min_client_key" = ''
WHERE "manifest"->'unbound'->>'min' ~ '^[23]\.';
