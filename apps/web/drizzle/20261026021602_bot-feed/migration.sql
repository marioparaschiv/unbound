-- Hand-written (`drizzle-kit generate --custom`): objects drizzle-kit does not model, on the tables of
-- the generated baseline before it. Sequence ownership, and the bot feed functions and triggers.
ALTER SEQUENCE "moderation_event_id_seq" OWNED BY "moderation_event"."id";--> statement-breakpoint
ALTER SEQUENCE "bot_feed_change_seq" OWNED BY "bot_feed_change"."seq";--> statement-breakpoint
-- Bot feeds: triggers move a key of `bot_feed_change` past every other key whenever one of its feed's
-- inputs changes, read through `src/lib/bot/feed.ts`. They catch every writer, Better Auth included.
-- `DISTINCT`, because one INSERT … ON CONFLICT must not update a row twice.
CREATE FUNCTION bot_feed_touch(p_feed text, p_keys text[]) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO bot_feed_change (feed, key, seq, changed_at)
	SELECT p_feed, k, next_ordered_id('bot_feed_change_seq'), statement_timestamp()
	FROM (SELECT DISTINCT unnest(p_keys) AS k) keys
	ON CONFLICT (feed, key) DO UPDATE SET seq = excluded.seq, changed_at = excluded.changed_at;
END $$;--> statement-breakpoint
-- Every maintainer of an addon, as members.
CREATE FUNCTION bot_feed_touch_maintainers(p_addon_id text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
	PERFORM bot_feed_touch('members', ARRAY(SELECT user_id FROM addon_maintainer WHERE addon_id = p_addon_id));
END $$;--> statement-breakpoint
CREATE FUNCTION bot_feed_on_addon() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	PERFORM bot_feed_touch('addons', ARRAY[NEW.id]);
	-- Delisting and relisting change whether the addon's maintainers are addon developers.
	IF TG_OP = 'UPDATE' AND OLD.delisted_at IS DISTINCT FROM NEW.delisted_at THEN
		PERFORM bot_feed_touch_maintainers(NEW.id);
	END IF;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER bot_feed_addon AFTER INSERT OR UPDATE ON addon
FOR EACH ROW EXECUTE FUNCTION bot_feed_on_addon();--> statement-breakpoint
CREATE FUNCTION bot_feed_on_addon_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	PERFORM bot_feed_touch('addons', ARRAY[NEW.addon_id]);
	PERFORM bot_feed_touch_maintainers(NEW.addon_id);
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER bot_feed_addon_version AFTER INSERT OR UPDATE OF withdrawn_by ON addon_version
FOR EACH ROW EXECUTE FUNCTION bot_feed_on_addon_version();--> statement-breakpoint
CREATE FUNCTION bot_feed_on_maintainer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	PERFORM bot_feed_touch('members', ARRAY[CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END]);
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER bot_feed_maintainer AFTER INSERT OR DELETE ON addon_maintainer
FOR EACH ROW EXECUTE FUNCTION bot_feed_on_maintainer();--> statement-breakpoint
-- Only Discord and GitHub links are members' inputs. Token refreshes rewrite other columns on every
-- sign-in, so an update fires only on the columns that move a link.
CREATE FUNCTION bot_feed_on_account() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'INSERT' AND NEW.provider_id IN ('discord', 'github') THEN
		PERFORM bot_feed_touch('members', ARRAY[NEW.user_id]);
	ELSIF TG_OP = 'DELETE' AND OLD.provider_id IN ('discord', 'github') THEN
		PERFORM bot_feed_touch('members', ARRAY[OLD.user_id]);
	ELSIF TG_OP = 'UPDATE' AND (OLD.provider_id IN ('discord', 'github') OR NEW.provider_id IN ('discord', 'github')) THEN
		PERFORM bot_feed_touch('members', ARRAY[OLD.user_id, NEW.user_id]);
	END IF;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER bot_feed_account AFTER INSERT OR DELETE OR UPDATE OF user_id, provider_id, account_id ON account
FOR EACH ROW EXECUTE FUNCTION bot_feed_on_account();--> statement-breakpoint
CREATE FUNCTION bot_feed_on_user_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	PERFORM bot_feed_touch('members', ARRAY[OLD.id]);
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER bot_feed_user_delete AFTER DELETE ON "user"
FOR EACH ROW EXECUTE FUNCTION bot_feed_on_user_delete();--> statement-breakpoint
-- A sponsorship is keyed by GitHub id; its members are the users linked to that GitHub account.
CREATE FUNCTION bot_feed_on_sponsorship() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	github_ids text[] := CASE TG_OP
		WHEN 'INSERT' THEN ARRAY[NEW.github_id]
		WHEN 'DELETE' THEN ARRAY[OLD.github_id]
		ELSE ARRAY[OLD.github_id, NEW.github_id]
	END;
BEGIN
	PERFORM bot_feed_touch('members', ARRAY(
		SELECT user_id FROM account WHERE provider_id = 'github' AND account_id = ANY (github_ids)
	));
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER bot_feed_sponsorship AFTER INSERT OR UPDATE OR DELETE ON sponsorship
FOR EACH ROW EXECUTE FUNCTION bot_feed_on_sponsorship();--> statement-breakpoint
CREATE FUNCTION bot_feed_on_release() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM bot_feed_touch('releases', ARRAY[OLD.platform || ':' || OLD.version]);
	ELSE
		PERFORM bot_feed_touch('releases', ARRAY[NEW.platform || ':' || NEW.version]);
	END IF;
	RETURN NULL;
END $$;--> statement-breakpoint
CREATE TRIGGER bot_feed_release AFTER INSERT OR UPDATE OR DELETE ON loader_release
FOR EACH ROW EXECUTE FUNCTION bot_feed_on_release();
