-- Sign-up no longer asks Discord for an email; replace every stored one with the undeliverable
-- placeholder `getPlaceholderEmail` builds (`<discord id>@discord.invalid`).
UPDATE "user" SET "email" = "account"."account_id" || '@discord.invalid', "email_verified" = false
FROM "account"
WHERE "account"."user_id" = "user"."id" AND "account"."provider_id" = 'discord';--> statement-breakpoint
-- Users without a Discord account fall back to their own id, which is just as unique.
UPDATE "user" SET "email" = "id" || '@unbound.invalid', "email_verified" = false
WHERE "email" NOT LIKE '%@discord.invalid';
