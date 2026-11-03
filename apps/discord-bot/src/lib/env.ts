import { type StaticDecode, safeParse, Type } from '@unbound-app/contracts/schema';
import { DEFAULT_PERK_GRACE_DAYS } from '@unbound-app/web/bot';

// The process environment holds only strings, so each number is a string check plus a decode to a number.
const integerAtLeast = (minimum: number, message: string) =>
	Type.Decode(
		Type.Refine(
			Type.String(),
			(value: string) => Number.isInteger(Number(value)) && Number(value) >= minimum,
			() => message,
		),
		Number,
	);

const positiveInt = integerAtLeast(1, 'Too small: expected number to be >0');
const nonNegativeInt = integerAtLeast(0, 'Too small: expected number to be >=0');

export const databaseEnvSchema = Type.Object({
	/** The web's database as the bot's role, direct, for `LISTEN` and migrations, e.g. `postgres://unbound_bot:<password>@127.0.0.1:5432/unbound`. */
	DATABASE_DIRECT_URL: Type.String({ minLength: 1 }),
});

/** The telemetry variables as they arrive, named as telecord names them so both export to SigNoz alike. */
const otelSource = Type.Object({
	/** The single gate: `true` or `1` exports the audit trail. */
	OTEL_ENABLED: Type.Optional(Type.String()),
	/** The OTLP/HTTP collector, e.g. `http://localhost:4318`. */
	OTEL_ENDPOINT: Type.Optional(Type.String({ format: 'url' })),
	/** The service SigNoz files the records under; `-dev` is appended under `NODE_ENV=development`. */
	OTEL_SERVICE_NAME: Type.Optional(Type.String({ minLength: 1 })),
	/** `development` marks the service as dev, since dev and production export to the same SigNoz. */
	NODE_ENV: Type.Optional(Type.String()),
});

// `parse` does not apply schema defaults, so each object codec below applies them as it decodes.
function readOtel(raw: StaticDecode<typeof otelSource>) {
	return {
		OTEL_ENABLED: raw.OTEL_ENABLED === 'true' || raw.OTEL_ENABLED === '1',
		OTEL_ENDPOINT: raw.OTEL_ENDPOINT?.replace(/\/+$/, ''),
		OTEL_SERVICE_NAME: raw.OTEL_SERVICE_NAME ?? 'unbound-discord-bot',
		NODE_ENV: raw.NODE_ENV ?? 'production',
	};
}

/** The telemetry variables, decoded and defaulted. */
export const otelEnvSchema = Type.Decode(otelSource, readOtel);

const envSource = Type.Object({
	...databaseEnvSchema.properties,
	/** The same database through pgbouncer in transaction mode, for queries, e.g. `postgres://unbound_bot:<password>@127.0.0.1:6432/unbound`. */
	DATABASE_URL: Type.String({ minLength: 1 }),
	/** The Discord bot token. */
	DISCORD_TOKEN: Type.String({ minLength: 1 }),
	/** Seconds between the timed reconciles of every dispatcher. */
	RECONCILE_INTERVAL_SECONDS: Type.Optional(positiveInt),
	/** Days sponsor perks outlast a sponsorship; keep it equal to the web's `SPONSOR_PERK_GRACE_DAYS`. */
	SPONSOR_PERK_GRACE_DAYS: Type.Optional(nonNegativeInt),
	/** Raises the GitHub API rate limit for the contributor lookup; an empty value counts as unset. */
	GITHUB_TOKEN: Type.Optional(Type.Decode(Type.String(), (token) => token || undefined)),
	...otelSource.properties,
});

/** The environment, decoded and defaulted. */
export const envSchema = Type.Decode(envSource, (raw) => ({
	DATABASE_DIRECT_URL: raw.DATABASE_DIRECT_URL,
	DATABASE_URL: raw.DATABASE_URL,
	DISCORD_TOKEN: raw.DISCORD_TOKEN,
	RECONCILE_INTERVAL_SECONDS: raw.RECONCILE_INTERVAL_SECONDS ?? 300,
	SPONSOR_PERK_GRACE_DAYS: raw.SPONSOR_PERK_GRACE_DAYS ?? DEFAULT_PERK_GRACE_DAYS,
	GITHUB_TOKEN: raw.GITHUB_TOKEN,
	...readOtel(raw),
}));

export type Env = StaticDecode<typeof envSchema>;
export type DatabaseEnv = StaticDecode<typeof databaseEnvSchema>;
export type OtelEnv = StaticDecode<typeof otelEnvSchema>;
export type EnvSource = Record<string, string | undefined>;

/** The variables `envSchema` requires, in schema order; a missing one fails as a group, so startup names them apart. */
export const REQUIRED_ENV: readonly string[] = envSource.required ?? [];

/**
 * @description Parses and validates the telemetry variables, applying their defaults.
 * @param source The raw environment, `process.env` by default.
 * @returns The decoded telemetry environment.
 * @throws Error listing every issue when a variable is malformed.
 */
export function parseOtelEnv(source: EnvSource = process.env): OtelEnv {
	const result = safeParse(otelEnvSchema, source);

	if (!result.success) {
		throw new Error(`Invalid environment:\n${result.error.message}`);
	}

	return result.data;
}

/**
 * @description Parses only the variables the migration script needs.
 * @param source The raw environment, `process.env` by default.
 * @returns The validated database environment.
 */
export function parseDatabaseEnv(source: EnvSource = process.env): DatabaseEnv {
	const result = safeParse(databaseEnvSchema, source);

	if (!result.success) {
		throw new Error(`Invalid environment:\n${result.error.message}`);
	}

	return result.data;
}

export default { databaseEnvSchema, otelEnvSchema, envSchema, parseDatabaseEnv, parseOtelEnv };
