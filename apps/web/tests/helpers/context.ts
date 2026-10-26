import { makeSignature } from 'better-auth/crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAppContext } from '~/lib/context';
import type { AppContext } from '~/lib/context';
import { createDatabase } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';
import { DISCORD_EPOCH } from '~/lib/discord';
import { CLI_CLIENT_ID } from '~/api/client';
import type { EnvSource } from '~/lib/env';
import { parseEnv } from '~/lib/env';

export const TEST_ENV = {
	PUBLIC_URL: 'http://localhost:3000',
	CDN_URL: 'http://cdn.localhost:3000',
	BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
	DISCORD_CLIENT_ID: 'discord-client',
	DISCORD_CLIENT_SECRET: 'discord-secret',
	DISCORD_BOT_TOKEN: 'discord-bot-token',
	GITHUB_CLIENT_ID: 'github-client',
	GITHUB_CLIENT_SECRET: 'github-secret',
	S3_ENDPOINT: 'http://127.0.0.1:9000',
	S3_REGION: 'us-east-1',
	S3_ACCESS_KEY_ID: 'access-key',
	S3_SECRET_ACCESS_KEY: 'secret-key',
	S3_STAGING_BUCKET: 'unbound-staging',
	S3_PUBLIC_BUCKET: 'unbound-addons',
} satisfies EnvSource;

/** The MinIO endpoint and buckets `bun run test:s3` provides, for `createTestContext` in `*.s3.ts` files. */
export const S3_TEST_ENV = {
	S3_ENDPOINT: process.env.S3_ENDPOINT,
	S3_REGION: process.env.S3_REGION,
	S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
	S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
	S3_STAGING_BUCKET: process.env.S3_STAGING_BUCKET,
	S3_PUBLIC_BUCKET: process.env.S3_PUBLIC_BUCKET,
} satisfies EnvSource;

export type TestContext = {
	ctx: AppContext;
	/** Closes the database and deletes its temporary directory. */
	close: () => void;
};

export type DiscordProfile = {
	id: string;
	name: string;
	email: string;
};

/** An expiring GitHub token, as GitHub Apps and OAuth apps with token expiry issue them. */
export type ExpiringGitHubToken = {
	accessTokenExpiresAt: Date;
	refreshToken: string;
};

export type SignedInUser = {
	userId: string;
	/** The session token, sent as a bearer token in `headers`. */
	token: string;
	headers: Headers;
};

/**
 * @description Builds an application context over a fresh, migrated SQLite file in a temporary
 * directory, from {@link TEST_ENV} plus any overrides.
 * @param overrides Environment variables to replace.
 * @returns The context and a `close` that disposes of the database.
 */
export function createTestContext(overrides: EnvSource = {}): TestContext {
	const dir = mkdtempSync(join(tmpdir(), 'unbound-web-'));
	const env = parseEnv({ ...TEST_ENV, DATABASE_PATH: join(dir, 'unbound.db'), ...overrides });
	const db = createDatabase(env.DATABASE_PATH);

	migrateDatabase(db);

	return {
		ctx: createAppContext(env, db),
		close: () => {
			db.$client.close();
			rmSync(dir, { recursive: true, force: true });
		},
	};
}

/**
 * @description Builds a Discord snowflake id created at the given time, e.g. for an account of a
 * chosen age.
 * @param date The creation time.
 * @returns The snowflake.
 */
export function snowflakeAt(date: Date): string {
	return String((BigInt(date.getTime()) - DISCORD_EPOCH) << 22n);
}

/**
 * @description Sends a request to the Better Auth handler as a same-origin browser would.
 * @param ctx The application context.
 * @param path The path below `/api/auth`, e.g. `/get-session`.
 * @param init The request init; a plain object `body` is sent as JSON.
 * @returns The auth handler's response.
 */
export function authRequest(ctx: AppContext, path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers);

	headers.set('origin', ctx.env.PUBLIC_URL);

	if (init.body) {
		headers.set('content-type', 'application/json');
	}

	return ctx.auth.handler(
		new Request(new URL(`/api/auth${path}`, ctx.env.PUBLIC_URL), { ...init, headers }),
	);
}

/**
 * @description Creates a user and Discord account exactly as the Discord OAuth callback does (through
 * Better Auth's internal adapter, so database hooks such as the admin plugin's default role run),
 * then opens a session for it. Discord itself is never contacted.
 * @param ctx The application context.
 * @param profile The Discord profile the callback would have received.
 * @returns The user id and headers carrying the session as a bearer token.
 */
export async function signInWithDiscord(
	ctx: AppContext,
	profile: DiscordProfile,
): Promise<SignedInUser> {
	const { internalAdapter } = await ctx.auth.$context;

	const { user } = await internalAdapter.createOAuthUser(
		{ name: profile.name, email: profile.email, emailVerified: true, image: null },
		{ providerId: 'discord', accountId: profile.id },
	);

	const session = await internalAdapter.createSession(user.id);

	return {
		userId: user.id,
		token: session.token,
		headers: new Headers({ authorization: `Bearer ${session.token}` }),
	};
}

/**
 * @description Builds the signed session cookie a browser holds after signing in.
 * @param ctx The application context.
 * @param token The session token.
 * @returns Headers carrying the session as a cookie.
 */
export async function browserSessionHeaders(ctx: AppContext, token: string): Promise<Headers> {
	const { authCookies } = await ctx.auth.$context;
	const signature = await makeSignature(token, ctx.env.BETTER_AUTH_SECRET);
	const value = encodeURIComponent(`${token}.${signature}`);

	return new Headers({ cookie: `${authCookies.sessionToken.name}=${value}` });
}

/**
 * @description Runs the device authorization flow `ubd login` uses: requests a code, approves it as
 * the signed-in user and exchanges it for a session.
 * @param ctx The application context.
 * @param headers The approving user's session headers.
 * @returns Headers carrying the device-flow session as a bearer token.
 */
export async function authorizeDevice(ctx: AppContext, headers: Headers): Promise<Headers> {
	const code = await authRequest(ctx, '/device/code', {
		method: 'POST',
		body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
	}).then((response) => response.json());

	// The verification page claims the code for the signed-in user before it can be approved.
	await authRequest(ctx, `/device?user_code=${code.user_code}`, { headers });
	await authRequest(ctx, '/device/approve', {
		method: 'POST',
		headers,
		body: JSON.stringify({ userCode: code.user_code }),
	});

	const token = await authRequest(ctx, '/device/token', {
		method: 'POST',
		body: JSON.stringify({
			grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
			device_code: code.device_code,
			client_id: CLI_CLIENT_ID,
		}),
	}).then((response) => response.json());

	return new Headers({ authorization: `Bearer ${token.access_token}` });
}

/**
 * @description Links a GitHub account to a user as the account-linking callback does.
 * @param ctx The application context.
 * @param userId The user to link.
 * @param accessToken The GitHub OAuth token GitHub's API is called with.
 * @param expiring When the token expires and the refresh token that renews it; omitted, it never expires.
 */
export async function linkGitHub(
	ctx: AppContext,
	userId: string,
	accessToken: string,
	expiring?: ExpiringGitHubToken,
) {
	const { internalAdapter } = await ctx.auth.$context;

	await internalAdapter.linkAccount({
		userId,
		providerId: 'github',
		accountId: userId,
		accessToken,
		...expiring,
	});
}
