CREATE TABLE "discord_compat" (
	"platform" text,
	"version" text,
	"build" text,
	"channel" text NOT NULL,
	"broken" integer NOT NULL,
	"fallbacks" integer NOT NULL,
	"scanned_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "discord_compat_pkey" PRIMARY KEY("platform","version")
);
