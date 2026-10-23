import type { SyncOAuthConfig, SyncSignInResponse } from '@unbound-app/contracts/sync';
import { z } from 'zod';

import { isBanned, toCallerProfile } from '~/lib/api/caller';
import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

// `email` lets a first sign-in create the account exactly as the web's Discord sign-in would.
const SCOPES = ['identify', 'email'];

const tokenResponseSchema = z.object({
	access_token: z.string().min(1),
	scope: z.string().optional(),
});

const discordUserSchema = z.object({
	id: z.string().regex(/^\d+$/),
	username: z.string(),
	global_name: z.string().nullish(),
	discriminator: z.string().optional(),
	avatar: z.string().nullish(),
	email: z.string().nullish(),
	verified: z.boolean().optional(),
});

type DiscordUser = z.infer<typeof discordUserSchema>;

type DiscordProfile = {
	user: DiscordUser;
	scope: string | undefined;
};

function discordUrl(env: Env, path: string): URL {
	return new URL(path, `${env.DISCORD_API_URL.replace(/\/$/, '')}/`);
}

// Mirrors Better Auth's Discord provider, so in-app and web sign-ups store the same avatar.
function avatarUrl(user: DiscordUser): string {
	if (!user.avatar) {
		const index =
			!user.discriminator || user.discriminator === '0'
				? Number(BigInt(user.id) >> 22n) % 6
				: Number.parseInt(user.discriminator, 10) % 5;

		return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
	}

	const format = user.avatar.startsWith('a_') ? 'gif' : 'png';

	return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${format}`;
}

/**
 * @description Describes the OAuth request the client opens Discord's in-app authorize screen with.
 * @param env The validated environment.
 * @returns The client id, the redirect URI registered for web sign-in, and the scopes.
 */
export function getSyncOAuthConfig(env: Env): SyncOAuthConfig {
	return {
		clientId: env.DISCORD_CLIENT_ID,
		redirectUri: new URL('/api/auth/callback/discord', env.PUBLIC_URL).href,
		scopes: SCOPES,
	};
}

async function fetchDiscordProfile(env: Env, code: string): Promise<DiscordProfile> {
	const response = await fetch(discordUrl(env, 'oauth2/token'), {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.DISCORD_CLIENT_ID,
			client_secret: env.DISCORD_CLIENT_SECRET,
			grant_type: 'authorization_code',
			code,
			redirect_uri: getSyncOAuthConfig(env).redirectUri,
		}),
	});

	if (response.status === 400 || response.status === 401) {
		throw new ApiError(
			'invalid_request',
			'The Discord authorization code is invalid or expired.',
		);
	}

	if (!response.ok) {
		throw new Error(`Discord answered ${response.status} to the token exchange.`);
	}

	const token = tokenResponseSchema.parse(await response.json());
	const profile = await fetch(discordUrl(env, 'users/@me'), {
		headers: { authorization: `Bearer ${token.access_token}` },
	});

	if (!profile.ok) {
		throw new Error(`Discord answered ${profile.status} for the signed-in user.`);
	}

	return { user: discordUserSchema.parse(await profile.json()), scope: token.scope };
}

async function findOrCreateUser(ctx: AppContext, profile: DiscordProfile): Promise<string> {
	const { internalAdapter } = await ctx.auth.$context;
	const { user, scope } = profile;
	const owner = await internalAdapter.findAccountOwnerByKey({
		providerId: 'discord',
		accountId: user.id,
	});

	if (owner?.kind === 'owned') {
		return owner.user.id;
	}

	if (!user.email) {
		throw new ApiError('invalid_request', 'Discord did not share an email address.');
	}

	// Web sign-in never links by email either, so a taken email is someone else's account.
	if (await internalAdapter.findUserByEmail(user.email)) {
		throw new ApiError('forbidden', 'Another Unbound account uses this email address.');
	}

	const created = await internalAdapter.createOAuthUser(
		{
			name: user.global_name || user.username,
			email: user.email,
			emailVerified: user.verified ?? false,
			image: avatarUrl(user),
		},
		{ providerId: 'discord', accountId: user.id, scope },
	);

	return created.user.id;
}

/**
 * @description Signs a user in with a code from Discord's in-app OAuth screen: exchanges it, finds
 * or creates the Unbound account linked to that Discord account, and opens a session.
 * @param ctx The application context.
 * @param code The authorization code Discord returned to the client.
 * @returns The session token and the signed-in user. Banned users are refused with `forbidden`.
 */
export async function signInWithDiscordCode(
	ctx: AppContext,
	code: string,
): Promise<SyncSignInResponse> {
	const userId = await findOrCreateUser(ctx, await fetchDiscordProfile(ctx.env, code));
	const user = await ctx.db.query.user.findFirst({ where: { id: userId } });

	if (!user) {
		throw new Error(`User ${userId} vanished while signing in.`);
	}

	if (isBanned(user, ctx.now())) {
		throw new ApiError('forbidden', 'This account is banned.');
	}

	const { internalAdapter } = await ctx.auth.$context;
	const session = await internalAdapter.createSession(userId);

	return { token: session.token, user: toCallerProfile(user) };
}

export default { getSyncOAuthConfig, signInWithDiscordCode };
