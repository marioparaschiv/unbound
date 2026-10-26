import { z } from 'zod';

import { isBotTokenHost } from '~/lib/discord';

const positiveInt = z.coerce.number().int().positive();

export const envSchema = z.object({
	PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
	PUBLIC_URL: z.url(),
	CDN_URL: z.url(),
	DATABASE_PATH: z.string().min(1),

	BETTER_AUTH_SECRET: z.string().min(32),
	DISCORD_CLIENT_ID: z.string().min(1),
	DISCORD_CLIENT_SECRET: z.string().min(1),
	/** Reads manifest authors' public Discord profiles. */
	DISCORD_BOT_TOKEN: z.string().min(1),
	GITHUB_CLIENT_ID: z.string().min(1),
	GITHUB_CLIENT_SECRET: z.string().min(1),

	/** The request header carrying the client IP, e.g. `cf-connecting-ip` behind Cloudflare. */
	IP_ADDRESS_HEADER: z.string().min(1).default('x-forwarded-for'),
	AUTH_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(60),
	AUTH_RATE_LIMIT_MAX: positiveInt.default(100),
	API_KEY_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(86_400),
	API_KEY_RATE_LIMIT_MAX: positiveInt.default(1000),

	S3_ENDPOINT: z.url(),
	S3_REGION: z.string().min(1),
	S3_ACCESS_KEY_ID: z.string().min(1),
	S3_SECRET_ACCESS_KEY: z.string().min(1),
	S3_STAGING_BUCKET: z.string().min(1),
	S3_PUBLIC_BUCKET: z.string().min(1),

	GITHUB_API_URL: z.url().default('https://api.github.com'),
	DISCORD_API_URL: z
		.url()
		.default('https://discord.com/api/v10')
		.refine(
			(value) => URL.canParse(value) && isBotTokenHost(new URL(value)),
			'Must be https://discord.com or loopback.',
		),
	DISCORD_PROFILE_TTL_SECONDS: positiveInt.default(86_400),
	DISCORD_PROFILE_SWEEP_INTERVAL_SECONDS: positiveInt.default(3600),

	/** The sponsored account. The webhook also needs the secret; the reconcile also needs the token. */
	GITHUB_SPONSORS_LOGIN: z.string().min(1).optional(),
	/** A token of the sponsored account that can read its sponsorships through GraphQL. */
	GITHUB_SPONSORS_TOKEN: z.string().min(1).optional(),
	GITHUB_SPONSORS_WEBHOOK_SECRET: z.string().min(1).optional(),
	SPONSOR_RECONCILE_INTERVAL_SECONDS: positiveInt.default(3600),
	SPONSOR_PERK_GRACE_DAYS: z.coerce.number().int().nonnegative().default(7),

	/** The `owner/name` whose build tags CI publishes without review; unset turns first-party publishing off. */
	FIRST_PARTY_REPOSITORY: z.string().min(1).optional(),

	ADDON_MAX_BYTES: positiveInt.default(25 * 1024 * 1024),
	/** The largest ADDON.md and CHANGELOG.md read from a repository. */
	ADDON_TEXT_MAX_BYTES: positiveInt.default(100 * 1024),
	/** Per user, across the endpoints that read GitHub with the user's token. */
	GITHUB_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(600),
	GITHUB_RATE_LIMIT_MAX: positiveInt.default(60),
	SUBMISSION_MAX_PENDING_LISTINGS: positiveInt.default(2),
	SUBMISSION_MAX_PENDING_UPDATES: positiveInt.default(1),
	SUBMISSION_MIN_ACCOUNT_AGE_DAYS: z.coerce.number().int().nonnegative().default(30),
	SUBMISSION_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(3600),
	SUBMISSION_RATE_LIMIT_MAX: positiveInt.default(10),

	/** How long a reviewer's presigned download of a staged bundle stays valid. */
	REVIEW_ARTIFACT_URL_TTL_SECONDS: positiveInt.default(600),
	STAGING_SWEEP_INTERVAL_SECONDS: positiveInt.default(3600),
	STAGING_ORPHAN_GRACE_SECONDS: positiveInt.default(3600),
	UPDATES_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(60),
	UPDATES_RATE_LIMIT_MAX: positiveInt.default(30),
	ADDON_LIST_PAGE_SIZE: positiveInt.default(50),
	DEVELOPER_LIST_PAGE_SIZE: positiveInt.default(24),
	USER_LIST_PAGE_SIZE: positiveInt.default(25),
	EVENT_PAGE_SIZE: positiveInt.default(100),

	SYNC_MAX_INSTALLS: positiveInt.default(100),
	SYNC_MAX_STORE_BYTES: positiveInt.default(32 * 1024),
	SYNC_MAX_DOCUMENT_BYTES: positiveInt.default(256 * 1024),
	SYNC_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(60),
	SYNC_RATE_LIMIT_MAX: positiveInt.default(30),
	SYNC_SIGN_IN_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(60),
	SYNC_SIGN_IN_RATE_LIMIT_MAX: positiveInt.default(10),
});

export type Env = z.infer<typeof envSchema>;
export type EnvSource = Record<string, string | undefined>;

/**
 * @description Parses and validates the process environment, failing loudly on anything missing or
 * malformed so the server never boots half-configured.
 * @param source The raw environment, `process.env` by default.
 * @returns The validated environment.
 */
export function parseEnv(source: EnvSource = process.env): Env {
	const result = envSchema.safeParse(source);

	if (!result.success) {
		throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
	}

	return result.data;
}

export default { envSchema, parseEnv };
