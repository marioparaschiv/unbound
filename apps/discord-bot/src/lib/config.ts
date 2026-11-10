import { type StaticDecode, type TSchema, safeParse, Type } from '@unbound-app/contracts/schema';
import { DEFAULT_PERK_GRACE_DAYS } from '@unbound-app/web/bot';

import { CDN_URL, DISCORD_IDS, GUILD_ID, SITE_URL, type DiscordIds } from '~/lib/constants';

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

// Migrations run in deploys and CI without the Discord secrets, so they read this slice alone.
const databaseSource = Type.Object({
	/** The web's database as the bot's role, direct, for `LISTEN` and migrations, e.g. `postgres://unbound_bot:<password>@127.0.0.1:5432/unbound`. */
	DATABASE_DIRECT_URL: Type.String({ minLength: 1 }),
});

const envSource = Type.Object({
	...databaseSource.properties,
	/** The same database through pgbouncer in transaction mode, for queries, e.g. `postgres://unbound_bot:<password>@127.0.0.1:6432/unbound`. */
	DATABASE_URL: Type.String({ minLength: 1 }),
	/** The Discord bot token. */
	DISCORD_TOKEN: Type.String({ minLength: 1 }),
	/** Seconds between the timed reconciles of every dispatcher. */
	RECONCILE_INTERVAL_SECONDS: Type.Optional(positiveInt),
	/**
	 * Days sponsor perks outlast a sponsorship. Unset, it is the web's default; set it only together
	 * with the web's own `SPONSOR_PERK_GRACE_DAYS`, so a role and the perks it shows end together.
	 */
	SPONSOR_PERK_GRACE_DAYS: Type.Optional(nonNegativeInt),
	/** Raises the GitHub API rate limit for the contributor lookup; an empty value counts as unset. */
	GITHUB_TOKEN: Type.Optional(Type.Decode(Type.String(), (token) => token || undefined)),
	// The telemetry variables are named as telecord names them, so both export to SigNoz alike.
	/** The single gate: `true` or `1` exports the audit trail. */
	OTEL_ENABLED: Type.Optional(Type.String()),
	/** The OTLP/HTTP collector, e.g. `http://localhost:4318`. */
	OTEL_ENDPOINT: Type.Optional(Type.String({ format: 'url' })),
	/** The service SigNoz files the records under; `-dev` is appended under `NODE_ENV=development`. */
	OTEL_SERVICE_NAME: Type.Optional(Type.String({ minLength: 1 })),
	/** `development` marks the service as dev, since dev and production export to the same SigNoz. */
	NODE_ENV: Type.Optional(Type.String()),
	/** Set by `bun run` from `package.json`; the telemetry's service version. */
	npm_package_version: Type.Optional(Type.String()),
});

// `parse` does not apply schema defaults, so the codec applies them as it decodes.
const envSchema = Type.Decode(envSource, (raw) => ({
	DATABASE_DIRECT_URL: raw.DATABASE_DIRECT_URL,
	DATABASE_URL: raw.DATABASE_URL,
	DISCORD_TOKEN: raw.DISCORD_TOKEN,
	RECONCILE_INTERVAL_SECONDS: raw.RECONCILE_INTERVAL_SECONDS ?? 300,
	SPONSOR_PERK_GRACE_DAYS: raw.SPONSOR_PERK_GRACE_DAYS ?? DEFAULT_PERK_GRACE_DAYS,
	GITHUB_TOKEN: raw.GITHUB_TOKEN,
	OTEL_ENABLED: raw.OTEL_ENABLED === 'true' || raw.OTEL_ENABLED === '1',
	OTEL_ENDPOINT: raw.OTEL_ENDPOINT?.replace(/\/+$/, ''),
	OTEL_SERVICE_NAME: raw.OTEL_SERVICE_NAME ?? 'unbound-discord-bot',
	NODE_ENV: raw.NODE_ENV ?? 'production',
	npm_package_version: raw.npm_package_version ?? 'unknown',
}));

export type Env = StaticDecode<typeof envSchema>;
export type OtelEnv = Pick<
	Env,
	'OTEL_ENABLED' | 'OTEL_ENDPOINT' | 'OTEL_SERVICE_NAME' | 'NODE_ENV' | 'npm_package_version'
>;
export type EnvSource = Record<string, string | undefined>;

/** Everything the bot reads from outside its code: the environment, and the guild, ids and urls it serves. */
export type BotConfig = {
	env: Env;
	guildId: string;
	/** The id constants; an `undefined` id is unset, and a dispatcher that needs it is not started. */
	ids: DiscordIds;
	siteUrl: string;
	cdnUrl: string;
};

/** What migrations need: the direct database url, and nothing Discord. */
export type DatabaseConfig = StaticDecode<typeof databaseSource>;

type Loaded<T> = { ok: true; config: T } | { ok: false; message: string };

export type ConfigResult = Loaded<BotConfig>;
export type DatabaseConfigResult = Loaded<DatabaseConfig>;

function decodeEnv<T extends TSchema>(
	schema: T,
	required: readonly string[],
	source: EnvSource,
): Loaded<StaticDecode<T>> {
	// A missing required variable fails as a group, so each is named apart.
	const missing = required.filter((name) => source[name] === undefined);
	const result = safeParse(schema, source);

	if (result.success) {
		return { ok: true, config: result.data };
	}

	const problems = missing.map((name) => `env ${name} is not set`);

	for (const issue of result.error.issues) {
		const name = issue.path.replace(/^\//, '');

		// The validator reports every missing key in one issue; `missing` names each of them instead.
		if (!name || missing.includes(name)) {
			continue;
		}

		problems.push(`env ${name}: ${issue.message}`);
	}

	return {
		ok: false,
		message: `Refusing to start, the configuration is incomplete:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`,
	};
}

/**
 * @description Reads the bot's whole configuration; the only reader of `process.env`, so one failure names everything to fix.
 * @param source The raw environment, `process.env` at startup.
 * @returns The configuration, or a message listing every unset or invalid variable.
 */
export function loadConfig(source: EnvSource): ConfigResult {
	const loaded = decodeEnv(envSchema, envSource.required ?? [], source);

	if (!loaded.ok) {
		return loaded;
	}

	return {
		ok: true,
		config: {
			env: loaded.config,
			guildId: GUILD_ID,
			ids: DISCORD_IDS,
			siteUrl: SITE_URL,
			cdnUrl: CDN_URL,
		},
	};
}

/**
 * @description Reads only the database slice of the configuration, for migrations, which run without the Discord secrets.
 * @param source The raw environment, `process.env` at startup.
 * @returns The database configuration, or a message naming what is unset or invalid.
 */
export function loadDatabaseConfig(source: EnvSource): DatabaseConfigResult {
	return decodeEnv(databaseSource, databaseSource.required ?? [], source);
}

export default { loadConfig, loadDatabaseConfig };
