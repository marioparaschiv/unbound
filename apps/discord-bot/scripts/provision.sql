-- Provisions the bot's schema and its access to the web's tables in the web's database, as a superuser,
-- in two phases. Phase `grant` (the default) runs after the web's migrations and before the bot's; phase
-- `lock` runs after the bot's first `db:migrate`:
--   psql -X -v database=unbound -v web_role=unbound_web -v bot_role=unbound_bot < scripts/provision.sql
--   (bun run db:migrate, as the bot)
--   psql -X -v database=unbound -v web_role=unbound_web -v bot_role=unbound_bot -v phase=lock < scripts/provision.sql
-- `lock` hands the trigger functions to a NOLOGIN role (`-v hooks_role=…`, default `<bot_role>_hooks`) and
-- revokes TRIGGER, so the bot cannot run code as the web's role. Rerun `grant` when the bot reads a new
-- web table. To change or reinstall the triggers (a web migration rebuilt a hooked table, or the bot logs
-- one missing): run `grant`, apply the trigger migration SQL, run `lock`. Both roles must exist; their
-- passwords are set outside this script. Rerunning either phase converges to the same state.
\set ON_ERROR_STOP on
\set QUIET on

\if :{?database}
\else
	\set missing true
\endif
\if :{?web_role}
\else
	\set missing true
\endif
\if :{?bot_role}
\else
	\set missing true
\endif
\if :{?missing}
	DO $$ BEGIN RAISE EXCEPTION 'Pass -v database=<name> -v web_role=<role> -v bot_role=<role>.'; END $$;
\endif
\if :{?phase}
\else
	\set phase grant
\endif
\if :{?hooks_role}
\else
	\set hooks_role :bot_role _hooks
\endif

\connect :"database"

SELECT set_config('provision.web_role', :'web_role', false),
	set_config('provision.bot_role', :'bot_role', false),
	set_config('provision.hooks_role', :'hooks_role', false),
	:'phase' = 'lock' AS locking,
	:'phase' NOT IN ('grant', 'lock') AS unknown_phase \gset

\if :unknown_phase
	DO $$ BEGIN RAISE EXCEPTION 'Pass -v phase=grant or -v phase=lock.'; END $$;
\endif

DO $$
DECLARE
	web_role text := current_setting('provision.web_role');
	bot_role text := current_setting('provision.bot_role');
	missing text[];
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = web_role) THEN
		RAISE EXCEPTION 'Role % does not exist.', web_role;
	END IF;

	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = bot_role) THEN
		RAISE EXCEPTION 'Role % does not exist; create it with LOGIN and a password first.', bot_role;
	END IF;

	SELECT array_agg(name) INTO missing
	FROM unnest(ARRAY['addon', 'addon_version', 'addon_maintainer', 'account', 'user', 'sponsorship',
		'moderation_event', 'loader_release']) AS name
	WHERE NOT EXISTS (
		SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = name AND tableowner = web_role
	);

	IF missing IS NOT NULL THEN
		RAISE EXCEPTION 'Tables % are missing from public or not owned by %; run the web''s migrations first.',
			missing, web_role;
	END IF;
END $$;

\if :locking

BEGIN;

DO $$
DECLARE
	bot_role text := current_setting('provision.bot_role');
	hooks_role text := current_setting('provision.hooks_role');
	hook regprocedure;
	hooks int := 0;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = hooks_role) THEN
		EXECUTE format('CREATE ROLE %I NOLOGIN', hooks_role);
	END IF;

	EXECUTE format('ALTER ROLE %I NOLOGIN', hooks_role);

	-- A member could act as the owner again.
	IF pg_has_role(bot_role, hooks_role, 'MEMBER') THEN
		RAISE EXCEPTION 'Role % is a member of %; revoke that first.', bot_role, hooks_role;
	END IF;

	FOR hook IN
		SELECT DISTINCT trigger.tgfoid::regprocedure
		FROM pg_trigger AS trigger
		JOIN pg_class AS hooked ON hooked.oid = trigger.tgrelid
		JOIN pg_proc AS body ON body.oid = trigger.tgfoid
		WHERE hooked.relnamespace = 'public'::regnamespace AND body.pronamespace = to_regnamespace('bot')
	LOOP
		EXECUTE format('ALTER FUNCTION %s OWNER TO %I', hook, hooks_role);
		hooks := hooks + 1;
	END LOOP;

	IF hooks = 0 THEN
		RAISE EXCEPTION 'No bot trigger is installed on public; run the bot''s migrations before the lock phase.';
	END IF;
END $$;

REVOKE TRIGGER ON public.addon, public.addon_version, public.addon_maintainer, public.account,
	public.sponsorship, public.moderation_event, public.loader_release FROM :"bot_role";
-- A schema named after another role sits first on that role's default search_path and could shadow
-- built-in functions in its sessions, so the bot may create schemas only while it migrates.
REVOKE CREATE ON DATABASE :"database" FROM :"bot_role";

COMMIT;

\else

BEGIN;

CREATE SCHEMA IF NOT EXISTS bot AUTHORIZATION :"bot_role";
ALTER SCHEMA bot OWNER TO :"bot_role";
-- CREATE because drizzle's migrator runs CREATE SCHEMA IF NOT EXISTS bot, which Postgres checks before it
-- finds the schema exists. The lock phase takes it back.
GRANT CONNECT, CREATE ON DATABASE :"database" TO :"bot_role";
GRANT USAGE ON SCHEMA public TO :"bot_role";

-- Converge to exactly the list below; a table REVOKE clears that table's column grants too.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"bot_role";
GRANT SELECT ON public.addon, public.addon_version, public.addon_maintainer, public.sponsorship,
	public.moderation_event, public.loader_release TO :"bot_role";
-- Links and names only, never tokens, emails or sessions.
GRANT SELECT (user_id, provider_id, account_id) ON public.account TO :"bot_role";
GRANT SELECT (id, name) ON public."user" TO :"bot_role";
-- Lets the bot's migrations install or replace its notify triggers until the lock phase takes it back.
GRANT TRIGGER ON public.addon, public.addon_version, public.addon_maintainer, public.account,
	public.sponsorship, public.moderation_event, public.loader_release TO :"bot_role";

-- Gives back trigger functions a previous lock took, so CREATE OR REPLACE can change them.
DO $$
DECLARE
	bot_role text := current_setting('provision.bot_role');
	hook regprocedure;
BEGIN
	FOR hook IN
		SELECT body.oid::regprocedure
		FROM pg_proc AS body
		JOIN pg_roles AS owner ON owner.oid = body.proowner
		WHERE body.pronamespace = 'bot'::regnamespace
			AND owner.rolname = current_setting('provision.hooks_role')
	LOOP
		EXECUTE format('ALTER FUNCTION %s OWNER TO %I', hook, bot_role);
	END LOOP;
END $$;

COMMIT;

\endif

\set QUIET off
\echo 'Phase' :'phase' 'done. Granted to' :"bot_role" 'on public:'
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee = :'bot_role' AND table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
SELECT table_name, string_agg(column_name, ', ' ORDER BY column_name) AS readable_columns
FROM information_schema.column_privileges
WHERE grantee = :'bot_role' AND table_schema = 'public' AND table_name IN ('account', 'user')
	AND privilege_type = 'SELECT'
GROUP BY table_name
ORDER BY table_name;
SELECT body.oid::regprocedure AS trigger_function, pg_get_userbyid(body.proowner) AS owner
FROM pg_proc AS body
WHERE body.pronamespace = to_regnamespace('bot')
ORDER BY body.oid::regprocedure::text;
