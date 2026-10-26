import { and, eq, exists, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { addon, addonMaintainer, addonVersion, account, sponsorship } from '~/db/schema';
import { isSponsoring, perkGraceMs, standingOf } from '~/lib/sponsors/standing';
import type { ReadDatabase, ResolvedReadOptions } from '~/lib/bot/reads';
import type { Member, MemberQuery } from '~/lib/bot/types';

// Only `user_id`, `provider_id` and `account_id` of `account` are granted to the bot, never tokens.
const discord = alias(account, 'discord');
const github = alias(account, 'github');

function maintainsListedAddon(db: ReadDatabase) {
	const live = db
		.select({ one: sql`1` })
		.from(addonVersion)
		.where(and(eq(addonVersion.addonId, addon.id), isNull(addonVersion.withdrawnBy)));

	return exists(
		db
			.select({ one: sql`1` })
			.from(addonMaintainer)
			.innerJoin(addon, eq(addon.id, addonMaintainer.addonId))
			.where(
				and(
					eq(addonMaintainer.userId, discord.userId),
					isNull(addon.delistedAt),
					exists(live),
				),
			),
	);
}

function memberFilter(db: ReadDatabase, query: MemberQuery): SQL | undefined {
	if (query.by === 'all') return;

	const ids = [...query.ids];

	switch (query.by) {
		case 'user': {
			return inArray(discord.userId, ids);
		}
		case 'discord': {
			return inArray(discord.accountId, ids);
		}
		case 'github': {
			return inArray(github.accountId, ids);
		}
		case 'addon': {
			return inArray(
				discord.userId,
				db
					.select({ userId: addonMaintainer.userId })
					.from(addonMaintainer)
					.where(inArray(addonMaintainer.addonId, ids)),
			);
		}
	}
}

/**
 * @description Reads the Discord-linked users a query names, with what their roles depend on.
 * @param db The read database.
 * @param options The read options; the clock and grace period judge sponsor standing.
 * @param query Every member, or the members with these user, Discord, GitHub or maintained addon ids.
 * @returns The members; a user without a Discord link is never one.
 */
export async function readMembers(
	db: ReadDatabase,
	options: ResolvedReadOptions,
	query: MemberQuery,
): Promise<Member[]> {
	if (query.by !== 'all' && !query.ids.length) {
		return [];
	}

	const rows = await db
		.select({
			userId: discord.userId,
			discordId: discord.accountId,
			githubId: github.accountId,
			sponsorship,
			isAddonDeveloper: sql<boolean>`${maintainsListedAddon(db)}`.mapWith(Boolean),
		})
		.from(discord)
		.leftJoin(github, and(eq(github.userId, discord.userId), eq(github.providerId, 'github')))
		.leftJoin(sponsorship, eq(sponsorship.githubId, github.accountId))
		.where(and(eq(discord.providerId, 'discord'), memberFilter(db, query)));

	const now = options.now();
	const grace = perkGraceMs(options.sponsorGraceDays);

	return rows.map((row) => ({
		userId: row.userId,
		discordId: row.discordId,
		githubId: row.githubId,
		isAddonDeveloper: row.isAddonDeveloper,
		isSponsor: isSponsoring(standingOf(row.sponsorship ?? undefined, now, grace)),
	}));
}

export default { readMembers };
