import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import type { Auth as BetterAuth, BetterAuthOptions } from 'better-auth';
import { admin, bearer, deviceAuthorization } from 'better-auth/plugins';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { AdminOptions } from 'better-auth/plugins';
import { createLogger } from '@unbound-app/logger';
import { apiKey } from '@better-auth/api-key';
import { betterAuth } from 'better-auth';

import { recordAuthAdminAction } from '~/lib/moderation-events';
import { API_KEY_HEADER, CLI_CLIENT_ID } from '~/api/client';
import { DEFAULT_ROLE, ac, roles } from '~/lib/auth/access';
import type { FileRoutesByTo } from '~/routeTree.gen';
import { purgeUserSubmissions } from '~/lib/staging';
import type { Database } from '~/db/database';
import type { Storage } from '~/lib/storage';
import * as schema from '~/db/schema';
import type { Env } from '~/lib/env';

const logger = createLogger('Web', 'Auth');

const DEVICE_VERIFICATION_PATH = '/device' satisfies keyof FileRoutesByTo;

const adminOptions = {
	ac,
	roles,
	defaultRole: DEFAULT_ROLE,
	adminRoles: ['admin'],
} satisfies AdminOptions;

type AuthPlugins = [
	ReturnType<typeof admin<typeof adminOptions>>,
	ReturnType<typeof bearer>,
	ReturnType<typeof deviceAuthorization>,
	ReturnType<typeof apiKey>,
];

// Named so declaration emit can reference it; the inferred options type is too large to serialize.
type AuthOptions = Omit<BetterAuthOptions, 'plugins'> & {
	plugins: AuthPlugins;
};

export type Auth = BetterAuth<AuthOptions>;
export type Session = Auth['$Infer']['Session'];

/**
 * @description Builds the Better Auth instance: Discord is the only sign-up path, GitHub can only be
 * linked to an existing session, and the CLI authenticates through device authorization or API keys.
 * Banning a user cancels their open submissions and deletes their staged files, and bans, unbans and
 * role changes are recorded as moderation events.
 * @param db The database the auth tables live in.
 * @param env The validated environment.
 * @param storage The object storage, for purging a banned user's staged files.
 * @returns The configured Better Auth instance.
 */
export function createAuth(db: Database, env: Env, storage: Storage): Auth {
	const options: AuthOptions = {
		appName: 'Unbound',
		baseURL: env.PUBLIC_URL,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.PUBLIC_URL],
		database: drizzleAdapter(db, { provider: 'sqlite', schema }),
		socialProviders: {
			discord: {
				clientId: env.DISCORD_CLIENT_ID,
				clientSecret: env.DISCORD_CLIENT_SECRET,
			},
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
				disableSignUp: true,
			},
		},
		account: {
			accountLinking: {
				enabled: true,
				// GitHub is linked explicitly from a signed-in session; an OAuth sign-in must never attach
				// itself to an account just because the emails match.
				disableImplicitLinking: true,
				allowDifferentEmails: true,
			},
		},
		rateLimit: {
			enabled: true,
			storage: 'database',
			window: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
			max: env.AUTH_RATE_LIMIT_MAX,
		},
		advanced: {
			ipAddress: {
				ipAddressHeaders: [env.IP_ADDRESS_HEADER],
			},
		},
		databaseHooks: {
			user: {
				update: {
					// The admin plugin's ban is a user update; purging here also covers bans made outside it.
					after: async (updated) => {
						if (updated.banned !== true) return;

						try {
							await purgeUserSubmissions({ db, storage }, updated.id);
						} catch (error) {
							// The submissions are cancelled first, so the staging sweeper reaps what is left.
							logger.error(
								`Failed to purge the staged files of banned user ${updated.id}:`,
								error,
							);
						}
					},
				},
			},
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== '/sign-in/social' || ctx.body?.provider !== 'github') return;

				throw new APIError('FORBIDDEN', {
					message: 'GitHub can only be linked to an existing account.',
				});
			}),
			after: createAuthMiddleware(async (ctx) => {
				if (!ctx.path.startsWith('/admin/')) return;

				try {
					recordAuthAdminAction(db, {
						path: ctx.path,
						actorId: ctx.context.session?.user.id ?? null,
						at: new Date(),
						body: ctx.body,
						returned: ctx.context.returned,
					});
				} catch (error) {
					// The action itself already committed; a missing record must not fail it.
					logger.error(`Failed to record the moderation event for ${ctx.path}:`, error);
				}
			}),
		},
		plugins: [
			admin(adminOptions),
			bearer(),
			deviceAuthorization({
				verificationUri: DEVICE_VERIFICATION_PATH,
				validateClient: (clientId) => clientId === CLI_CLIENT_ID,
			}),
			apiKey({
				apiKeyHeaders: API_KEY_HEADER,
				rateLimit: {
					enabled: true,
					timeWindow: env.API_KEY_RATE_LIMIT_WINDOW_SECONDS * 1000,
					maxRequests: env.API_KEY_RATE_LIMIT_MAX,
				},
			}),
		],
	};

	return betterAuth(options);
}

export default { createAuth };
