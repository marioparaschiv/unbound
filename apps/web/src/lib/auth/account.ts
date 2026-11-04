import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import type { ApiKey } from '@better-auth/api-key';
import type { Account } from 'better-auth';

import type { SponsorOverview } from '~/lib/sponsors/overview';
import { getSponsorOverview } from '~/lib/sponsors/overview';
import { readDiscordUser } from '~/lib/authors/profiles';
import { isDiscordId } from '~/lib/discord';
import app from '~/lib/app';

export type AccountApiKey = Pick<
	ApiKey,
	'id' | 'name' | 'start' | 'createdAt' | 'expiresAt' | 'lastRequest'
>;

/** `id` is the account row id, which unlinking takes. */
export type LinkedAccount = Pick<Account, 'id' | 'providerId'>;

export type AccountOverview = {
	/** The Discord username shown under the profile name; `null` when Discord did not answer. */
	username: string | null;
	accounts: LinkedAccount[];
	apiKeys: AccountApiKey[];
	sponsor: SponsorOverview;
};

/**
 * @description Loads what `/account` manages for the signed-in user: their Discord username, linked
 * accounts, API keys and their GitHub sponsorship.
 * @returns The username, the linked accounts, the user's API keys, newest first, and their sponsorship and perks.
 */
export const getAccountOverview = createServerFn({ method: 'GET' }).handler(
	async (): Promise<AccountOverview> => {
		const headers = getRequestHeaders();
		const [session, accounts, keys] = await Promise.all([
			app.auth.api.getSession({ headers }),
			app.auth.api.listUserAccounts({ headers }),
			app.auth.api.listApiKeys({
				headers,
				query: { sortBy: 'createdAt', sortDirection: 'desc' },
			}),
		]);

		if (!session) {
			throw new Error('Sign in to see your account.');
		}

		const discord = accounts.find((account) => account.providerId === 'discord');
		const [discordUser, sponsor] = await Promise.all([
			discord && isDiscordId(discord.accountId)
				? readDiscordUser(app, discord.accountId)
				: undefined,
			getSponsorOverview(app, session.user.id),
		]);

		return {
			username: discordUser?.username ?? null,
			accounts: accounts.map((account) => ({
				id: account.id,
				providerId: account.providerId,
			})),
			apiKeys: keys.apiKeys.map((key) => ({
				id: key.id,
				name: key.name,
				start: key.start,
				createdAt: key.createdAt,
				expiresAt: key.expiresAt,
				lastRequest: key.lastRequest,
			})),
			sponsor,
		};
	},
);

export default { getAccountOverview };
