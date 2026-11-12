ALTER TABLE "sponsorship" ADD COLUMN "largest_one_time_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "sponsorship" SET "largest_one_time_cents" = "monthly_price_cents" WHERE "one_time";
