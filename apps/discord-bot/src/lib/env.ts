import { DEFAULT_PERK_GRACE_DAYS } from '@unbound-app/web/bot';
import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const databaseEnvSchema = z.object({
	/** The web's database as the bot's role, direct, for `LISTEN` and migrations, e.g. `postgres://unbound_bot:<password>@127.0.0.1:5432/unbound`. */
	DATABASE_DIRECT_URL: z.string().min(1),
});

export const envSchema = databaseEnvSchema.extend({
	/** The same database through pgbouncer in transaction mode, for queries, e.g. `postgres://unbound_bot:<password>@127.0.0.1:6432/unbound`. */
	DATABASE_URL: z.string().min(1),
	/** The Discord bot token. */
	DISCORD_TOKEN: z.string().min(1),
	/** Seconds between the timed reconciles of every dispatcher. */
	RECONCILE_INTERVAL_SECONDS: positiveInt.default(300),
	/** Days sponsor perks outlast a sponsorship; keep it equal to the web's `SPONSOR_PERK_GRACE_DAYS`. */
	SPONSOR_PERK_GRACE_DAYS: z.coerce.number().int().nonnegative().default(DEFAULT_PERK_GRACE_DAYS),
	/** Raises the GitHub API rate limit for the contributor lookup; an empty value counts as unset. */
	GITHUB_TOKEN: z
		.string()
		.optional()
		.transform((token) => token || undefined),
});

export type Env = z.infer<typeof envSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type EnvSource = Record<string, string | undefined>;

/**
 * @description Parses only the variables the migration script needs.
 * @param source The raw environment, `process.env` by default.
 * @returns The validated database environment.
 */
export function parseDatabaseEnv(source: EnvSource = process.env): DatabaseEnv {
	const result = databaseEnvSchema.safeParse(source);

	if (!result.success) {
		throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
	}

	return result.data;
}

export default { databaseEnvSchema, envSchema, parseDatabaseEnv };
