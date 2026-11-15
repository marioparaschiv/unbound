ALTER TABLE "bot"."mod_case" ALTER COLUMN "id" SET START WITH 2728;--> statement-breakpoint
-- `START WITH` only applies on a restart; the next case is 2728, or follows any case already stored.
SELECT setval(pg_get_serial_sequence('bot.mod_case', 'id'), GREATEST(2727, (SELECT max("id") FROM "bot"."mod_case")));
