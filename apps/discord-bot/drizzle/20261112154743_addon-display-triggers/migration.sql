-- Hand-written (`drizzle-kit generate --custom`): wakes the bot for every addon change its card shows.
-- A maintainer's icon pick now wakes the addon, and so does a reviewed version's files being written:
-- approval commits the version pending, so only clearing `files_pending_since` makes it the served one.
-- Production locks these functions; run provision.sql `grant`, then this migration, then `lock`.
CREATE OR REPLACE FUNCTION bot.notify_addon() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	o jsonb := pg_catalog.to_jsonb(OLD);
	n jsonb := pg_catalog.to_jsonb(NEW);
	id text := coalesce(n ->> 'id', o ->> 'id');
BEGIN
	-- An update only when a listed field moves, never for `updated_at` alone.
	IF TG_OP <> 'UPDATE' OR EXISTS (
		SELECT FROM unnest(ARRAY['type', 'name', 'description', 'icon', 'delisted_at']) AS field
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
-- A new, withdrawn or newly published version changes the served listing and whether the addon makes its
-- maintainers developers; an update that moves neither `withdrawn_by` nor `files_pending_since` changes neither.
CREATE OR REPLACE FUNCTION bot.notify_addon_version() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	o jsonb := pg_catalog.to_jsonb(OLD);
	n jsonb := pg_catalog.to_jsonb(NEW);
	id text := n ->> 'addon_id';
BEGIN
	IF TG_OP = 'UPDATE' AND NOT EXISTS (
		SELECT FROM unnest(ARRAY['withdrawn_by', 'files_pending_since']) AS field
		WHERE o -> field IS DISTINCT FROM n -> field
	) THEN
		RETURN NULL;
	END IF;
	PERFORM pg_catalog.pg_notify('addon_changed', id) WHERE id IS NOT NULL;
	PERFORM pg_catalog.pg_notify('member_changed', 'addon:' || id) WHERE id IS NOT NULL;
	RETURN NULL;
END $$;
