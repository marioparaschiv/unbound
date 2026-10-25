import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const databaseEnvSchema = z.object({
	/** The bot's own Postgres database, e.g. `postgres://unbound_bot:<password>@localhost:5432/unbound_bot`. */
	DATABASE_URL: z.string().min(1),
});

export const envSchema = databaseEnvSchema.extend({
	/** The Discord bot token. */
	DISCORD_TOKEN: z.string().min(1),
	/** The Unbound backend serving `/api/v1/bot/*`, e.g. `https://unbound.rip`. */
	UNBOUND_API_URL: z.url(),
	/** An API key with the bot feed permission, sent as `x-api-key`. */
	UNBOUND_API_KEY: z.string().min(1),
	/** Seconds between rounds of polling every feed. */
	POLL_INTERVAL_SECONDS: positiveInt.default(30),
	/** Items requested per feed page; the backend caps it at 500. */
	FEED_PAGE_SIZE: positiveInt.max(500).default(100),
	/** Seconds between the timed reconciles of every dispatcher. */
	RECONCILE_INTERVAL_SECONDS: positiveInt.default(300),
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
