-- Hand-written (`drizzle-kit generate --custom`): wake-ups the bot installs on the web's tables. AFTER,
-- notify only, no reads, so they never fail or slow the web's write; the timed reconcile covers a miss.
-- No trigger names a column and every body reads the row as jsonb, so a web migration that drops,
-- retypes or renames a column never fails on them, and neither does the web's write afterwards.
-- Every statement is CREATE OR REPLACE, so after a web migration rebuilds a table this file reapplies.
-- An insert's OLD and a delete's NEW are null, so their jsonb is null and the payloads built from it are skipped.
CREATE OR REPLACE FUNCTION bot.notify_addon() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	o jsonb := pg_catalog.to_jsonb(OLD);
	n jsonb := pg_catalog.to_jsonb(NEW);
	id text := coalesce(n ->> 'id', o ->> 'id');
BEGIN
	-- An update only when a listed field moves, never for `updated_at` alone.
	IF TG_OP <> 'UPDATE' OR EXISTS (
		SELECT FROM unnest(ARRAY['type', 'name', 'description', 'delisted_at']) AS field
		WHERE o -> field IS DISTINCT FROM n -> field
	) THEN
		PERFORM pg_catalog.pg_notify('addon_changed', id) WHERE id IS NOT NULL;
	END IF;
	-- Delisting and relisting change whether the addon's maintainers are addon developers.
	IF TG_OP = 'UPDATE' AND o -> 'delisted_at' IS DISTINCT FROM n -> 'delisted_at' THEN
		PERFORM pg_catalog.pg_notify('member_changed', 'addon:' || id) WHERE id IS NOT NULL;
	END IF;
	RETURN NULL;
END $$;--> statement-breakpoint
-- A new or withdrawn version changes the served listing and whether the addon makes its maintainers developers.
CREATE OR REPLACE FUNCTION bot.notify_addon_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	o jsonb := pg_catalog.to_jsonb(OLD);
	n jsonb := pg_catalog.to_jsonb(NEW);
	id text := n ->> 'addon_id';
BEGIN
	IF TG_OP = 'UPDATE' AND o -> 'withdrawn_by' IS NOT DISTINCT FROM n -> 'withdrawn_by' THEN
		RETURN NULL;
	END IF;
	PERFORM pg_catalog.pg_notify('addon_changed', id) WHERE id IS NOT NULL;
	PERFORM pg_catalog.pg_notify('member_changed', 'addon:' || id) WHERE id IS NOT NULL;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION bot.notify_addon_maintainer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	id text := coalesce(pg_catalog.to_jsonb(NEW), pg_catalog.to_jsonb(OLD)) ->> 'user_id';
BEGIN
	PERFORM pg_catalog.pg_notify('member_changed', 'user:' || id) WHERE id IS NOT NULL;
	RETURN NULL;
END $$;--> statement-breakpoint
-- Only Discord and GitHub links, and only the columns that move a link; token refreshes rewrite others.
-- A link moving between users wakes both. A deleted user cascades here, so `"user"` needs no trigger.
CREATE OR REPLACE FUNCTION bot.notify_account() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	o jsonb := pg_catalog.to_jsonb(OLD);
	n jsonb := pg_catalog.to_jsonb(NEW);
BEGIN
	IF NOT (coalesce(o ->> 'provider_id' IN ('discord', 'github'), false)
		OR coalesce(n ->> 'provider_id' IN ('discord', 'github'), false)) THEN
		RETURN NULL;
	END IF;
	IF TG_OP = 'UPDATE' AND NOT EXISTS (
		SELECT FROM unnest(ARRAY['user_id', 'provider_id', 'account_id']) AS field
		WHERE o -> field IS DISTINCT FROM n -> field
	) THEN
		RETURN NULL;
	END IF;
	PERFORM pg_catalog.pg_notify('member_changed', 'user:' || (o ->> 'user_id')) WHERE o ->> 'user_id' IS NOT NULL;
	PERFORM pg_catalog.pg_notify('member_changed', 'user:' || (n ->> 'user_id')) WHERE n ->> 'user_id' IS NOT NULL;
	RETURN NULL;
END $$;--> statement-breakpoint
-- A sponsorship is keyed by GitHub id; the bot resolves the linked users when it reads, after commit.
CREATE OR REPLACE FUNCTION bot.notify_sponsorship() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	id text := pg_catalog.to_jsonb(NEW) ->> 'github_id';
BEGIN
	PERFORM pg_catalog.pg_notify('member_changed', 'github:' || id) WHERE id IS NOT NULL;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION bot.notify_moderation_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	id text := pg_catalog.to_jsonb(NEW) ->> 'id';
BEGIN
	PERFORM pg_catalog.pg_notify('audit_event', id) WHERE id IS NOT NULL;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION bot.notify_loader_release() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	n jsonb := pg_catalog.to_jsonb(NEW);
	release text := (n ->> 'platform') || ':' || (n ->> 'version');
BEGIN
	PERFORM pg_catalog.pg_notify('loader_release', release) WHERE release IS NOT NULL;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_addon AFTER INSERT OR UPDATE OR DELETE ON public.addon
	FOR EACH ROW EXECUTE FUNCTION bot.notify_addon();--> statement-breakpoint
-- Deletes only cascade from addon, which wakes the addon itself.
CREATE OR REPLACE TRIGGER bot_addon_version AFTER INSERT OR UPDATE ON public.addon_version
	FOR EACH ROW EXECUTE FUNCTION bot.notify_addon_version();--> statement-breakpoint
-- A maintainer added or removed; a role change does not matter.
CREATE OR REPLACE TRIGGER bot_addon_maintainer AFTER INSERT OR DELETE ON public.addon_maintainer
	FOR EACH ROW EXECUTE FUNCTION bot.notify_addon_maintainer();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_account AFTER INSERT OR UPDATE OR DELETE ON public.account
	FOR EACH ROW EXECUTE FUNCTION bot.notify_account();--> statement-breakpoint
-- A delete cannot grant anything, and roles are grant-only.
CREATE OR REPLACE TRIGGER bot_sponsorship AFTER INSERT OR UPDATE ON public.sponsorship
	FOR EACH ROW EXECUTE FUNCTION bot.notify_sponsorship();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_moderation_event AFTER INSERT ON public.moderation_event
	FOR EACH ROW EXECUTE FUNCTION bot.notify_moderation_event();--> statement-breakpoint
-- A republish (upsert of url and changelog) never re-announces, so only inserts wake the bot.
CREATE OR REPLACE TRIGGER bot_loader_release AFTER INSERT ON public.loader_release
	FOR EACH ROW EXECUTE FUNCTION bot.notify_loader_release();
