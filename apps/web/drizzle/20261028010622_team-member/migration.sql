CREATE TABLE "team_member" (
	"discord_id" text PRIMARY KEY,
	"group" text NOT NULL,
	"staff_role" text,
	"synced_at" timestamp(3) with time zone NOT NULL
);
