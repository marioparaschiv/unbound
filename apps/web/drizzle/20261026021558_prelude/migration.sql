-- Hand-written (`drizzle-kit generate --custom`): objects drizzle-kit does not model, which the
-- generated baseline after it needs. The trigram indexes need pg_trgm, and the `moderation_event`
-- DEFAULT needs its sequence and `next_ordered_id`.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE SEQUENCE "moderation_event_id_seq" AS bigint;--> statement-breakpoint
CREATE SEQUENCE "bot_feed_change_seq" AS bigint;--> statement-breakpoint
-- Commit-ordered ids: every id is drawn under one transaction-scoped advisory lock held to commit, and
-- Postgres makes a transaction visible before it releases its locks, so id n+1 is drawn only after the
-- holder of n is visible or rolled back. A reader paging by id or (seq, key) never sees n+1 without n.
-- One key for every sequence, so two ordered writes never take two ordering locks in opposite orders.
-- Table locks still can: a sponsorship write takes `account` SHARE, then this lock. So a transaction
-- that writes `account` (a user delete's cascade too) after drawing an ordered id locks `account` in
-- ROW EXCLUSIVE mode as its first statement: `account` before the ordering lock, always.
-- `nextval`, not max + 1: a serializable transaction that waited on the lock still reads an old snapshot.
CREATE FUNCTION lock_ordered_ids() RETURNS void
LANGUAGE sql VOLATILE AS $$
	SELECT pg_advisory_xact_lock(7695970, 1);
$$;--> statement-breakpoint
CREATE FUNCTION next_ordered_id(sequence regclass) RETURNS bigint
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
	PERFORM lock_ordered_ids();
	RETURN nextval(sequence);
END $$;
