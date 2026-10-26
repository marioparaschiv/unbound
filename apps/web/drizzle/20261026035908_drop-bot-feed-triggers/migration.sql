-- Hand-written (`drizzle-kit generate --custom`): the bot now reads the web's tables directly, woken by
-- its own triggers, so the bot feed goes. Triggers and functions first, since they write the table the
-- next migration drops. The prelude's comment on `bot_feed_change_seq` stays, as migrations are immutable.
DROP TRIGGER IF EXISTS bot_feed_addon ON addon;--> statement-breakpoint
DROP TRIGGER IF EXISTS bot_feed_addon_version ON addon_version;--> statement-breakpoint
DROP TRIGGER IF EXISTS bot_feed_maintainer ON addon_maintainer;--> statement-breakpoint
DROP TRIGGER IF EXISTS bot_feed_account ON account;--> statement-breakpoint
DROP TRIGGER IF EXISTS bot_feed_user_delete ON "user";--> statement-breakpoint
DROP TRIGGER IF EXISTS bot_feed_sponsorship ON sponsorship;--> statement-breakpoint
DROP TRIGGER IF EXISTS bot_feed_release ON loader_release;--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_on_addon();--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_on_addon_version();--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_on_maintainer();--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_on_account();--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_on_user_delete();--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_on_sponsorship();--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_on_release();--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_touch_maintainers(text);--> statement-breakpoint
DROP FUNCTION IF EXISTS bot_feed_touch(text, text[]);--> statement-breakpoint
DROP SEQUENCE IF EXISTS bot_feed_change_seq;--> statement-breakpoint
-- The feed's API key goes with it; the bot's user stays, as an ordinary user, with its history.
DELETE FROM apikey WHERE reference_id IN (SELECT id FROM "user" WHERE role = 'bot');--> statement-breakpoint
UPDATE "user" SET role = 'user' WHERE role = 'bot';
