-- Hand-written (`drizzle-kit generate --custom`): the wake-up for client bundles, under the rules
-- 20261026040605_web-triggers states. Insert only: a CI retry updates `min_loader_version` alone.
CREATE OR REPLACE FUNCTION bot.notify_bundle_release() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	n jsonb := pg_catalog.to_jsonb(NEW);
	bundle text := (n ->> 'channel') || ':' || (n ->> 'version');
BEGIN
	PERFORM pg_catalog.pg_notify('bundle_release', bundle) WHERE bundle IS NOT NULL;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_bundle_release AFTER INSERT ON public.bundle_release
	FOR EACH ROW EXECUTE FUNCTION bot.notify_bundle_release();
