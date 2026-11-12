import { MEDIA_MAX_BYTES, MEDIA_TOTAL_MAX_BYTES } from '@unbound-app/contracts/addon-page';
import { safeParse, Type, type StaticDecode } from '@unbound-app/contracts/schema';

import { DEFAULT_PERK_GRACE_DAYS } from '~/lib/sponsors/standing';
import { isBotTokenHost } from '~/lib/discord';

// Env values arrive as strings, so each count is checked as the text it arrives as and decoded to a number.
function count(defaultValue: number, message: string, passes: (value: number) => boolean) {
	return Type.Decode(
		Type.Refine(
			Type.Union([Type.String(), Type.Number()], { default: defaultValue }),
			(value: string | number) => Number.isInteger(Number(value)) && passes(Number(value)),
			() => message,
		),
		Number,
	);
}

const positiveInt = (defaultValue: number) =>
	count(defaultValue, 'Expected a whole number above 0', (value) => value > 0);

const nonNegativeInt = (defaultValue: number) =>
	count(defaultValue, 'Expected a whole number of 0 or more', (value) => value >= 0);

export const envSchema = Type.Object({
	PORT: count(3000, 'Expected a port from 1 to 65535', (value) => value >= 1 && value <= 65_535),
	PUBLIC_URL: Type.String({ format: 'url' }),
	CDN_URL: Type.String({ format: 'url' }),
	/** The pooled connection (pgbouncer, transaction mode) every query runs over. */
	DATABASE_URL: Type.String({ format: 'url' }),
	/** The direct connection migrations run over, past pgbouncer. */
	DATABASE_DIRECT_URL: Type.String({ format: 'url' }),

	BETTER_AUTH_SECRET: Type.String({ minLength: 32 }),
	DISCORD_CLIENT_ID: Type.String({ minLength: 1 }),
	DISCORD_CLIENT_SECRET: Type.String({ minLength: 1 }),
	/** Reads manifest authors' public Discord profiles. */
	DISCORD_BOT_TOKEN: Type.String({ minLength: 1 }),
	GITHUB_CLIENT_ID: Type.String({ minLength: 1 }),
	GITHUB_CLIENT_SECRET: Type.String({ minLength: 1 }),

	/** The request header carrying the client IP, e.g. `cf-connecting-ip` behind Cloudflare. */
	IP_ADDRESS_HEADER: Type.String({ minLength: 1, default: 'x-forwarded-for' }),
	AUTH_RATE_LIMIT_WINDOW_SECONDS: positiveInt(60),
	AUTH_RATE_LIMIT_MAX: positiveInt(100),
	API_KEY_RATE_LIMIT_WINDOW_SECONDS: positiveInt(86_400),
	API_KEY_RATE_LIMIT_MAX: positiveInt(1000),

	S3_ENDPOINT: Type.String({ format: 'url' }),
	S3_REGION: Type.String({ minLength: 1 }),
	S3_ACCESS_KEY_ID: Type.String({ minLength: 1 }),
	S3_SECRET_ACCESS_KEY: Type.String({ minLength: 1 }),
	S3_STAGING_BUCKET: Type.String({ minLength: 1 }),
	S3_PUBLIC_BUCKET: Type.String({ minLength: 1 }),

	GITHUB_API_URL: Type.String({ format: 'url', default: 'https://api.github.com' }),
	DISCORD_API_URL: Type.Refine(
		Type.String({ format: 'url', default: 'https://discord.com/api/v10' }),
		(value) => URL.canParse(value) && isBotTokenHost(new URL(value)),
		() => 'Must be https://discord.com or loopback.',
	),
	DISCORD_PROFILE_TTL_SECONDS: positiveInt(86_400),
	DISCORD_PROFILE_SWEEP_INTERVAL_SECONDS: positiveInt(3600),

	/** The Unbound Discord server whose roles decide the Team page and staff site roles. */
	DISCORD_GUILD_ID: Type.String({ pattern: /^\d+$/, default: '950850315601711176' }),
	/** The team role ids; while any is unset the team sync stays off. */
	DISCORD_ADMIN_ROLE_ID: Type.Optional(Type.String({ pattern: /^\d+$/ })),
	DISCORD_STAFF_ROLE_ID: Type.Optional(Type.String({ pattern: /^\d+$/ })),
	DISCORD_DEVELOPMENT_TEAM_ROLE_ID: Type.Optional(Type.String({ pattern: /^\d+$/ })),
	DISCORD_MANAGEMENT_ROLE_ID: Type.Optional(Type.String({ pattern: /^\d+$/ })),
	DISCORD_CONTRIBUTOR_ROLE_ID: Type.String({ pattern: /^\d+$/, default: '967799585844113418' }),
	DISCORD_ADDON_DEVELOPER_ROLE_ID: Type.String({
		pattern: /^\d+$/,
		default: '952688684107456612',
	}),
	TEAM_SYNC_INTERVAL_SECONDS: positiveInt(900),

	/** The sponsored account. The webhook also needs the secret; the reconcile also needs the token. */
	GITHUB_SPONSORS_LOGIN: Type.Optional(Type.String({ minLength: 1 })),
	/** A token of the sponsored account that can read its sponsorships through GraphQL. */
	GITHUB_SPONSORS_TOKEN: Type.Optional(Type.String({ minLength: 1 })),
	GITHUB_SPONSORS_WEBHOOK_SECRET: Type.Optional(Type.String({ minLength: 1 })),
	SPONSOR_RECONCILE_INTERVAL_SECONDS: positiveInt(3600),
	SPONSOR_PERK_GRACE_DAYS: nonNegativeInt(DEFAULT_PERK_GRACE_DAYS),

	/** The `owner/name` whose build tags CI publishes without review; unset turns first-party publishing off. */
	FIRST_PARTY_REPOSITORY: Type.Optional(Type.String({ minLength: 1 })),

	ADDON_MAX_BYTES: positiveInt(25 * 1024 * 1024),
	/** The largest ADDON.md and CHANGELOG.md read from a repository. */
	ADDON_TEXT_MAX_BYTES: positiveInt(100 * 1024),
	/** The largest media file ADDON.md shows, and all of an addon's media together; `ubd build` reads the same names. */
	ADDON_MEDIA_MAX_BYTES: positiveInt(MEDIA_MAX_BYTES),
	ADDON_MEDIA_TOTAL_MAX_BYTES: positiveInt(MEDIA_TOTAL_MAX_BYTES),
	/** Per user, across the endpoints that read GitHub with the user's token. */
	GITHUB_RATE_LIMIT_WINDOW_SECONDS: positiveInt(600),
	GITHUB_RATE_LIMIT_MAX: positiveInt(60),
	SUBMISSION_MAX_PENDING_LISTINGS: positiveInt(2),
	SUBMISSION_MAX_PENDING_UPDATES: positiveInt(1),
	SUBMISSION_MIN_ACCOUNT_AGE_DAYS: nonNegativeInt(30),
	SUBMISSION_RATE_LIMIT_WINDOW_SECONDS: positiveInt(3600),
	SUBMISSION_RATE_LIMIT_MAX: positiveInt(10),

	/** How long a reviewer's presigned download of a staged bundle stays valid. */
	REVIEW_ARTIFACT_URL_TTL_SECONDS: positiveInt(600),
	STAGING_SWEEP_INTERVAL_SECONDS: positiveInt(3600),
	STAGING_ORPHAN_GRACE_SECONDS: positiveInt(3600),
	UPDATES_RATE_LIMIT_WINDOW_SECONDS: positiveInt(60),
	UPDATES_RATE_LIMIT_MAX: positiveInt(30),
	FONTS_RATE_LIMIT_WINDOW_SECONDS: positiveInt(60),
	FONTS_RATE_LIMIT_MAX: positiveInt(20),
	CRASH_REPORTS_RATE_LIMIT_WINDOW_SECONDS: positiveInt(3600),
	CRASH_REPORTS_RATE_LIMIT_MAX: positiveInt(20),
	DEBUG_CARDS_RATE_LIMIT_WINDOW_SECONDS: positiveInt(3600),
	DEBUG_CARDS_RATE_LIMIT_MAX: positiveInt(30),
	ADDON_INSTALLS_RATE_LIMIT_WINDOW_SECONDS: positiveInt(86400),
	ADDON_INSTALLS_RATE_LIMIT_MAX: positiveInt(3),
	ADDON_LIST_PAGE_SIZE: positiveInt(50),
	ADMIN_ADDON_LIST_PAGE_SIZE: positiveInt(50),
	DEVELOPER_LIST_PAGE_SIZE: positiveInt(24),
	USER_LIST_PAGE_SIZE: positiveInt(25),
	EVENT_PAGE_SIZE: positiveInt(100),

	SYNC_MAX_INSTALLS: positiveInt(100),
	SYNC_MAX_STORE_BYTES: positiveInt(32 * 1024),
	SYNC_MAX_DOCUMENT_BYTES: positiveInt(256 * 1024),
	SYNC_RATE_LIMIT_WINDOW_SECONDS: positiveInt(60),
	SYNC_RATE_LIMIT_MAX: positiveInt(30),
	SYNC_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS: positiveInt(60),
	SYNC_SIGN_IN_RATE_LIMIT_MAX: positiveInt(10),
});

export type Env = StaticDecode<typeof envSchema>;
export type EnvSource = Record<string, string | undefined>;

/**
 * @description Parses and validates the process environment, failing loudly on anything missing or
 * malformed so the server never boots half-configured.
 * @param source The raw environment, `process.env` by default.
 * @returns The validated environment.
 */
export function parseEnv(source: EnvSource = process.env): Env {
	const result = safeParse(envSchema, source);

	if (!result.success) {
		throw new Error(`Invalid environment:\n${result.error.message}`);
	}

	return result.data;
}

export default { envSchema, parseEnv };
