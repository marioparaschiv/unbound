-- Hand-written (`drizzle-kit generate --custom`): wake-ups the bot installs on the web's tables. AFTER,
-- notify only, no reads, so they never fail or slow the web's write; the timed reconcile covers a miss.
-- Every statement is CREATE OR REPLACE, so after a web migration rebuilds a table this file reapplies.
-- Filters compare text and timestamps only: `json` has no equality, so a WHEN on it fails the write.
CREATE OR REPLACE FUNCTION bot.notify_addon_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_catalog.pg_notify('addon_changed', CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END);
	RETURN NULL;
END $$;--> statement-breakpoint
-- Delisting and relisting change whether the addon's maintainers are addon developers.
CREATE OR REPLACE FUNCTION bot.notify_addon_maintainers() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_catalog.pg_notify('member_changed', 'addon:' || NEW.id);
	RETURN NULL;
END $$;--> statement-breakpoint
-- A new or withdrawn version changes the served listing and whether the addon makes its maintainers developers.
CREATE OR REPLACE FUNCTION bot.notify_addon_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_catalog.pg_notify('addon_changed', NEW.addon_id);
	PERFORM pg_catalog.pg_notify('member_changed', 'addon:' || NEW.addon_id);
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION bot.notify_maintainer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_catalog.pg_notify('member_changed', 'user:' || CASE TG_OP WHEN 'DELETE' THEN OLD.user_id ELSE NEW.user_id END);
	RETURN NULL;
END $$;--> statement-breakpoint
-- A link moving between users wakes both.
CREATE OR REPLACE FUNCTION bot.notify_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		PERFORM pg_catalog.pg_notify('member_changed', 'user:' || OLD.user_id);
	END IF;
	IF TG_OP <> 'DELETE' THEN
		PERFORM pg_catalog.pg_notify('member_changed', 'user:' || NEW.user_id);
	END IF;
	RETURN NULL;
END $$;--> statement-breakpoint
-- A sponsorship is keyed by GitHub id; the bot resolves the linked users when it reads, after commit.
CREATE OR REPLACE FUNCTION bot.notify_sponsorship() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_catalog.pg_notify('member_changed', 'github:' || NEW.github_id);
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION bot.notify_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_catalog.pg_notify('audit_event', NEW.id::text);
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION bot.notify_loader_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_catalog.pg_notify('loader_release', NEW.platform || ':' || NEW.version);
	RETURN NULL;
END $$;--> statement-breakpoint
-- addon: insert and delete always; an update only when a listed field moves, never for `updated_at` alone.
CREATE OR REPLACE TRIGGER bot_addon_inserted AFTER INSERT ON public.addon
	FOR EACH ROW EXECUTE FUNCTION bot.notify_addon_changed();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_addon_deleted AFTER DELETE ON public.addon
	FOR EACH ROW EXECUTE FUNCTION bot.notify_addon_changed();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_addon_updated AFTER UPDATE OF type, name, description, delisted_at ON public.addon
	FOR EACH ROW
	WHEN ((OLD.type, OLD.name, OLD.description, OLD.delisted_at) IS DISTINCT FROM (NEW.type, NEW.name, NEW.description, NEW.delisted_at))
	EXECUTE FUNCTION bot.notify_addon_changed();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_addon_listing AFTER UPDATE OF delisted_at ON public.addon
	FOR EACH ROW WHEN (OLD.delisted_at IS DISTINCT FROM NEW.delisted_at)
	EXECUTE FUNCTION bot.notify_addon_maintainers();--> statement-breakpoint
-- addon_version: approved (insert) or withdrawn and restored (withdrawn_by). Deletes only cascade from addon.
CREATE OR REPLACE TRIGGER bot_addon_version_inserted AFTER INSERT ON public.addon_version
	FOR EACH ROW EXECUTE FUNCTION bot.notify_addon_version();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_addon_version_withdrawn AFTER UPDATE OF withdrawn_by ON public.addon_version
	FOR EACH ROW WHEN (OLD.withdrawn_by IS DISTINCT FROM NEW.withdrawn_by)
	EXECUTE FUNCTION bot.notify_addon_version();--> statement-breakpoint
-- addon_maintainer: a maintainer added or removed; a role change does not matter.
CREATE OR REPLACE TRIGGER bot_maintainer_changed AFTER INSERT OR DELETE ON public.addon_maintainer
	FOR EACH ROW EXECUTE FUNCTION bot.notify_maintainer();--> statement-breakpoint
-- account: only Discord and GitHub links, and only the columns that move a link; token refreshes rewrite others.
-- A deleted user cascades here, so `"user"` needs no trigger of its own.
CREATE OR REPLACE TRIGGER bot_account_inserted AFTER INSERT ON public.account
	FOR EACH ROW WHEN (NEW.provider_id IN ('discord', 'github'))
	EXECUTE FUNCTION bot.notify_account();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_account_deleted AFTER DELETE ON public.account
	FOR EACH ROW WHEN (OLD.provider_id IN ('discord', 'github'))
	EXECUTE FUNCTION bot.notify_account();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_account_updated AFTER UPDATE OF user_id, provider_id, account_id ON public.account
	FOR EACH ROW
	WHEN ((OLD.provider_id IN ('discord', 'github') OR NEW.provider_id IN ('discord', 'github'))
		AND (OLD.user_id, OLD.provider_id, OLD.account_id) IS DISTINCT FROM (NEW.user_id, NEW.provider_id, NEW.account_id))
	EXECUTE FUNCTION bot.notify_account();--> statement-breakpoint
-- sponsorship: any insert or update; a delete cannot grant anything, and roles are grant-only.
CREATE OR REPLACE TRIGGER bot_sponsorship_changed AFTER INSERT OR UPDATE ON public.sponsorship
	FOR EACH ROW EXECUTE FUNCTION bot.notify_sponsorship();--> statement-breakpoint
CREATE OR REPLACE TRIGGER bot_moderation_event_inserted AFTER INSERT ON public.moderation_event
	FOR EACH ROW EXECUTE FUNCTION bot.notify_audit_event();--> statement-breakpoint
-- A republish (upsert of url and changelog) never re-announces, so only inserts wake the bot.
CREATE OR REPLACE TRIGGER bot_loader_release_inserted AFTER INSERT ON public.loader_release
	FOR EACH ROW EXECUTE FUNCTION bot.notify_loader_release();
