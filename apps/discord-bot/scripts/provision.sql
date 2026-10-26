-- Provisions the bot's schema and its access to the web's tables in the web's database. Run it as a
-- superuser after the web's migrations and before the bot's, and again whenever the bot reads a new web
-- table or a web migration rebuilds one it reads (then rerun the bot's trigger migration SQL too):
--   psql -X -v database=unbound -v web_role=unbound_web -v bot_role=unbound_bot -f scripts/provision.sql
-- Both roles must exist; their passwords are set outside this script. Every run converges to the same grants.
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

\connect :"database"

SELECT set_config('provision.web_role', :'web_role', false),
	set_config('provision.bot_role', :'bot_role', false) \g /dev/null

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

BEGIN;

CREATE SCHEMA IF NOT EXISTS bot AUTHORIZATION :"bot_role";
ALTER SCHEMA bot OWNER TO :"bot_role";
-- CREATE because drizzle's migrator runs CREATE SCHEMA IF NOT EXISTS bot, which Postgres checks before it
-- finds the schema exists. It lets the role add schemas, never touch the web's.
GRANT CONNECT, CREATE ON DATABASE :"database" TO :"bot_role";
GRANT USAGE ON SCHEMA public TO :"bot_role";

-- Converge to exactly the list below; a table REVOKE clears that table's column grants too.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM :"bot_role";
GRANT SELECT ON public.addon, public.addon_version, public.addon_maintainer, public.sponsorship,
	public.moderation_event, public.loader_release TO :"bot_role";
-- Links and names only, never tokens, emails or sessions.
GRANT SELECT (user_id, provider_id, account_id) ON public.account TO :"bot_role";
GRANT SELECT (id, name) ON public."user" TO :"bot_role";
-- Lets the bot's migrations install its notify triggers; only a table's owner can drop them.
GRANT TRIGGER ON public.addon, public.addon_version, public.addon_maintainer, public.account,
	public.sponsorship, public.moderation_event, public.loader_release TO :"bot_role";

COMMIT;

\set QUIET off
\echo 'Granted to' :"bot_role" 'on public:'
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
