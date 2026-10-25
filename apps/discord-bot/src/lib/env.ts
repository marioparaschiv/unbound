import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const databaseEnvSchema = z.object({
	DATABASE_URL: z.string().min(1),
});

export const envSchema = databaseEnvSchema.extend({
	DISCORD_TOKEN: z.string().min(1),
	UNBOUND_API_URL: z.url(),
	UNBOUND_API_KEY: z.string().min(1),
	POLL_INTERVAL_SECONDS: positiveInt.default(30),
	FEED_PAGE_SIZE: positiveInt.max(500).default(100),
	RECONCILE_INTERVAL_SECONDS: positiveInt.default(300),
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
