import { anyDistinct, fromExcluded } from '~/db/excluded';
import { contentHash } from '~/lib/feed/content-hash';
import type { AddonFeedItem } from '~/lib/feed/types';
import type { Transaction } from '~/db/database';
import dedupe from '~/lib/feed/dedupe';
import { addon } from '~/db/schema';

/**
 * @description Upserts addon snapshots; an unchanged snapshot (same hash and listing) writes nothing.
 * @param tx The page's transaction.
 * @param items The page's addon items.
 * @returns Resolves once the page is written.
 */
export async function ingestAddons(tx: Transaction, items: AddonFeedItem[]): Promise<void> {
	if (!items.length) return;

	const rows = dedupe(items, (item) => item.id).map((item) => ({
		id: item.id,
		type: item.type,
		data: item,
		contentHash: contentHash(item),
		listed: item.listed,
		updatedAt: new Date(item.updatedAt),
	}));

	await tx
		.insert(addon)
		.values(rows)
		.onConflictDoUpdate({
			target: addon.id,
			set: fromExcluded({
				type: addon.type,
				data: addon.data,
				contentHash: addon.contentHash,
				listed: addon.listed,
				updatedAt: addon.updatedAt,
			}),
			setWhere: anyDistinct([addon.contentHash, addon.listed]),
		});
}

export default { ingestAddons };
