CREATE TABLE "crash_issue" (
	"fingerprint" text PRIMARY KEY,
	"issue_number" integer,
	"issue_url" text,
	"reports" integer DEFAULT 1 NOT NULL,
	"versions" text NOT NULL,
	"first_seen_at" timestamp(3) with time zone NOT NULL,
	"last_seen_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crash_report" ADD COLUMN "fingerprint" text;