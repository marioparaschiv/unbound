import { and, eq, exists, inArray, isNull, sql } from 'drizzle-orm';
import type { BotMember } from '@unbound-app/contracts/bot';
import { alias } from 'drizzle-orm/pg-core';

import { account, addon, addonMaintainer, addonVersion, sponsorship, user } from '~/db/schema';
import { isSponsoring, standingOf } from '~/lib/sponsors/standing';
import type { ChangeFeed, FeedChange } from '~/lib/bot/feed';
import { graceMs } from '~/lib/sponsors/sponsorships';
import type { AppContext } from '~/lib/context';

const discord = alias(account, 'discord');
const github = alias(account, 'github');

function maintainsListedAddon(ctx: AppContext) {
	const live = ctx.db
		.select({ one: sql`1` })
		.from(addonVersion)
		.where(and(eq(addonVersion.addonId, addon.id), isNull(addonVersion.withdrawnBy)));

	return exists(
		ctx.db
			.select({ one: sql`1` })
			.from(addonMaintainer)
			.innerJoin(addon, eq(addon.id, addonMaintainer.addonId))
			.where(
				and(eq(addonMaintainer.userId, user.id), isNull(addon.delistedAt), exists(live)),
			),
	);
}

async function hydrateMembers(
	ctx: AppContext,
	changes: FeedChange[],
): Promise<Map<string, BotMember>> {
	const rows = await ctx.db
		.select({
			userId: user.id,
			discordId: discord.accountId,
			githubId: github.accountId,
			sponsorship,
			isAddonDeveloper: sql<boolean>`${maintainsListedAddon(ctx)}`.mapWith(Boolean),
		})
		.from(user)
		.leftJoin(discord, and(eq(discord.userId, user.id), eq(discord.providerId, 'discord')))
		.leftJoin(github, and(eq(github.userId, user.id), eq(github.providerId, 'github')))
		.leftJoin(sponsorship, eq(sponsorship.githubId, github.accountId))
		.where(
			inArray(
				user.id,
				changes.map((change) => change.key),
			),
		);

	const found = new Map(rows.map((row) => [row.userId, row]));
	const now = ctx.now();
	const grace = graceMs(ctx.env);
	const items = new Map<string, BotMember>();

	for (const { key, changedAt } of changes) {
		const row = found.get(key);
		const updatedAt = changedAt.toISOString();

		// A deleted user, like one who unlinked Discord, reads as a member the bot can no longer match.
		if (!row) {
			items.set(key, {
				userId: key,
				discordId: null,
				isAddonDeveloper: false,
				isSponsor: false,
				updatedAt,
			});

			continue;
		}

		// A sponsorship lapsing with the clock moves no cursor; fine, because the bot only grants roles.
		const standing = standingOf(row.sponsorship ?? undefined, now, grace);

		items.set(key, {
			userId: key,
			discordId: row.discordId,
			githubId: row.githubId ?? undefined,
			githubLogin: row.sponsorship?.githubLogin,
			isAddonDeveloper: row.discordId !== null && row.isAddonDeveloper,
			isSponsor: row.discordId !== null && isSponsoring(standing),
			updatedAt,
		});
	}

	return items;
}

/** Every user whose Discord link, GitHub link, sponsorship or maintained listings changed. */
export const membersFeed: ChangeFeed<BotMember> = { name: 'members', hydrate: hydrateMembers };

export default { membersFeed };
