import { anyDistinct, fromExcluded } from '~/db/excluded';
import type { MemberFeedItem } from '~/lib/feed/types';
import type { Transaction } from '~/db/database';
import dedupe from '~/lib/feed/dedupe';
import { member } from '~/db/schema';

/**
 * @description Upserts linked members; a row is rewritten only when one of its columns differs.
 * @param tx The page's transaction.
 * @param items The page's member items.
 * @returns Resolves once the page is written.
 */
export async function ingestMembers(tx: Transaction, items: MemberFeedItem[]): Promise<void> {
	if (!items.length) return;

	const rows = dedupe(items, (item) => item.userId).map((item) => ({
		userId: item.userId,
		discordId: item.discordId,
		githubId: item.githubId ?? null,
		githubLogin: item.githubLogin ?? null,
		isAddonDeveloper: item.isAddonDeveloper,
		isSponsor: item.isSponsor,
		updatedAt: new Date(item.updatedAt),
	}));
	const columns = {
		discordId: member.discordId,
		githubId: member.githubId,
		githubLogin: member.githubLogin,
		isAddonDeveloper: member.isAddonDeveloper,
		isSponsor: member.isSponsor,
		updatedAt: member.updatedAt,
	};

	await tx
		.insert(member)
		.values(rows)
		.onConflictDoUpdate({
			target: member.userId,
			set: fromExcluded(columns),
			setWhere: anyDistinct(Object.values(columns)),
		});
}

export default { ingestMembers };
