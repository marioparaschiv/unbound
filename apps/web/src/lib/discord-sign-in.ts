import type { AccountOAuthConfig, AccountSignInResponse } from '@unbound-app/contracts/account';
import { parse, Type, type StaticDecode } from '@unbound-app/contracts/schema';

import { getPlaceholderEmail } from '~/lib/auth/placeholder-email';
import { getAvatarUrl, getDefaultAvatarUrl } from '~/lib/discord';
import { isBanned, toCallerProfile } from '~/lib/api/caller';
import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

/** The Discord scopes both web and in-app sign-in request; no email, so sign-up never needs one. */
export const DISCORD_SCOPES = ['identify'];

const tokenResponseSchema = Type.Object({
	access_token: Type.String({ minLength: 1 }),
	scope: Type.Optional(Type.String()),
});

const discordUserSchema = Type.Object({
	id: Type.String({ pattern: /^\d+$/ }),
	username: Type.String(),
	global_name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
	discriminator: Type.Optional(Type.String()),
	avatar: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

type DiscordUser = StaticDecode<typeof discordUserSchema>;

type DiscordProfile = {
	user: DiscordUser;
	scope: string | undefined;
};

function discordUrl(env: Env, path: string): URL {
	return new URL(path, `${env.DISCORD_API_URL.replace(/\/$/, '')}/`);
}

// Mirrors Better Auth's Discord provider, so in-app and web sign-ups store the same avatar.
function avatarUrl(user: DiscordUser): string {
	if (user.avatar) {
		return getAvatarUrl(user.id, user.avatar);
	}

	if (!user.discriminator || user.discriminator === '0') {
		return getDefaultAvatarUrl(user.id);
	}

	// Accounts that still have a legacy discriminator pick their default avatar from it.
	return `https://cdn.discordapp.com/embed/avatars/${Number.parseInt(user.discriminator, 10) % 5}.png`;
}

/**
 * @description Describes the OAuth request the client opens Discord's in-app authorize screen with.
 * @param env The validated environment.
 * @returns The client id, the redirect URI registered for web sign-in, and the scopes.
 */
export function getDiscordOAuthConfig(env: Env): AccountOAuthConfig {
	return {
		clientId: env.DISCORD_CLIENT_ID,
		redirectUri: new URL('/api/auth/callback/discord', env.PUBLIC_URL).href,
		scopes: DISCORD_SCOPES,
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
			redirect_uri: getDiscordOAuthConfig(env).redirectUri,
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

	const token = parse(tokenResponseSchema, await response.json());
	const profile = await fetch(discordUrl(env, 'users/@me'), {
		headers: { authorization: `Bearer ${token.access_token}` },
	});

	if (!profile.ok) {
		throw new Error(`Discord answered ${profile.status} for the signed-in user.`);
	}

	return { user: parse(discordUserSchema, await profile.json()), scope: token.scope };
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

	const created = await internalAdapter.createOAuthUser(
		{
			name: user.global_name || user.username,
			email: getPlaceholderEmail(user.id),
			emailVerified: false,
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
): Promise<AccountSignInResponse> {
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

export default { getDiscordOAuthConfig, signInWithDiscordCode };
