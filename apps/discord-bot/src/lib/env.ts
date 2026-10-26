import { DEFAULT_PERK_GRACE_DAYS } from '@unbound-app/web/bot';
import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const databaseEnvSchema = z.object({
	/** The web's database as the bot's role, direct, for `LISTEN` and migrations, e.g. `postgres://unbound_bot:<password>@127.0.0.1:5432/unbound`. */
	DATABASE_DIRECT_URL: z.string().min(1),
});

/** The telemetry variables, named as telecord names them so both export to SigNoz alike. */
export const otelEnvSchema = z.object({
	/** The single gate: `true` or `1` exports the audit trail. */
	OTEL_ENABLED: z
		.string()
		.optional()
		.transform((flag) => flag === 'true' || flag === '1'),
	/** The OTLP/HTTP collector, e.g. `http://localhost:4318`. */
	OTEL_ENDPOINT: z
		.url()
		.optional()
		.transform((url) => url?.replace(/\/+$/, '')),
	/** The service SigNoz files the records under; `-dev` is appended under `NODE_ENV=development`. */
	OTEL_SERVICE_NAME: z.string().min(1).default('unbound-discord-bot'),
	/** `development` marks the service as dev, since dev and production export to the same SigNoz. */
	NODE_ENV: z.string().default('production'),
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
	...otelEnvSchema.shape,
});

export type Env = z.infer<typeof envSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type OtelEnv = z.infer<typeof otelEnvSchema>;
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

export default { databaseEnvSchema, otelEnvSchema, envSchema, parseDatabaseEnv };
