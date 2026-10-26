import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { BotAddon } from '@unbound-app/contracts/bot';

import type { ChangeFeed, FeedChange } from '~/lib/bot/feed';
import type { AppContext } from '~/lib/context';
import { LIVE_VERSIONS } from '~/lib/live-versions';

function iconUrl(icon: PublishedManifest['icon']): string | undefined {
	const uri = typeof icon === 'string' ? icon : icon?.uri;

	if (!uri || !URL.canParse(uri)) return;

	const { protocol } = new URL(uri);

	return protocol === 'http:' || protocol === 'https:' ? uri : undefined;
}

async function hydrateAddons(
	ctx: AppContext,
	changes: FeedChange[],
): Promise<Map<string, BotAddon>> {
	const rows = await ctx.db.query.addon.findMany({
		where: { id: { in: changes.map((change) => change.key) } },
		columns: { id: true, type: true, name: true, description: true, delistedAt: true },
		with: {
			versions: {
				where: LIVE_VERSIONS,
				orderBy: { versionKey: 'desc' },
				limit: 1,
				columns: { version: true, manifest: true },
			},
		},
	});

	const changedAt = new Map(changes.map((change) => [change.key, change.changedAt]));
	const items = new Map<string, BotAddon>();

	for (const row of rows) {
		const served = row.versions.at(0);
		const updatedAt = changedAt.get(row.id);

		// Approval writes the addon and its first version together, so only a half-seeded addon has none.
		if (!served || !updatedAt) {
			continue;
		}

		items.set(row.id, {
			id: row.id,
			type: row.type,
			name: row.name,
			description: row.description,
			version: served.version,
			authors: served.manifest.authors.map((author) => ({
				name: author.name,
				discordId: author.id,
			})),
			iconUrl: iconUrl(served.manifest.icon),
			pageUrl: new URL(`/addons/${row.id}`, ctx.env.PUBLIC_URL).href,
			listed: row.delistedAt === null,
			updatedAt: updatedAt.toISOString(),
		});
	}

	return items;
}

/** Every addon whose listing changed, delists included, as it is now. */
export const addonsFeed: ChangeFeed<BotAddon> = { name: 'addons', hydrate: hydrateAddons };

export default { addonsFeed };
