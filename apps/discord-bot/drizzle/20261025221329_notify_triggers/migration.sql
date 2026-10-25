-- NOTIFY is a wake-up for the dispatchers; each payload is the changed row's key.
CREATE FUNCTION notify_addon_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_notify('addon_changed', NEW.id);
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER addon_inserted AFTER INSERT ON addon
	FOR EACH ROW EXECUTE FUNCTION notify_addon_changed();
--> statement-breakpoint
CREATE TRIGGER addon_updated AFTER UPDATE ON addon
	FOR EACH ROW
	WHEN (OLD.content_hash IS DISTINCT FROM NEW.content_hash OR OLD.listed IS DISTINCT FROM NEW.listed)
	EXECUTE FUNCTION notify_addon_changed();
--> statement-breakpoint
CREATE FUNCTION notify_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_notify('audit_event', NEW.id::text);
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_event_inserted AFTER INSERT ON audit_event
	FOR EACH ROW EXECUTE FUNCTION notify_audit_event();
--> statement-breakpoint
CREATE FUNCTION notify_loader_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_notify('loader_release', NEW.platform || ':' || NEW.version);
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER loader_release_inserted AFTER INSERT ON loader_release
	FOR EACH ROW EXECUTE FUNCTION notify_loader_release();
--> statement-breakpoint
CREATE FUNCTION notify_member_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM pg_notify('member_changed', NEW.user_id);
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER member_inserted AFTER INSERT ON member
	FOR EACH ROW EXECUTE FUNCTION notify_member_changed();
--> statement-breakpoint
CREATE TRIGGER member_updated AFTER UPDATE ON member
	FOR EACH ROW
	WHEN (
		OLD.discord_id IS DISTINCT FROM NEW.discord_id
		OR OLD.github_id IS DISTINCT FROM NEW.github_id
		OR OLD.github_login IS DISTINCT FROM NEW.github_login
		OR OLD.is_addon_developer IS DISTINCT FROM NEW.is_addon_developer
		OR OLD.is_sponsor IS DISTINCT FROM NEW.is_sponsor
	)
	EXECUTE FUNCTION notify_member_changed();
