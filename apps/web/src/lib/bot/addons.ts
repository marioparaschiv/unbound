import type { PublishedManifest } from '@unbound-app/contracts/manifest';

import type { ReadDatabase, ResolvedReadOptions } from '~/lib/bot/reads';
import { LIVE_VERSIONS } from '~/lib/live-versions';
import type { PublicAddon } from '~/lib/bot/types';

type AddonWithServed = Awaited<ReturnType<typeof queryAddons>>[number];

function queryAddons(db: ReadDatabase, id?: string) {
	return db.query.addon.findMany({
		where: id === undefined ? undefined : { id },
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
}

function iconUrl(icon: PublishedManifest['icon']): string | undefined {
	const uri = typeof icon === 'string' ? icon : icon?.uri;

	if (!uri || !URL.canParse(uri)) return;

	const { protocol } = new URL(uri);

	return protocol === 'http:' || protocol === 'https:' ? uri : undefined;
}

// An addon with no live version has nothing to show, so the bot removes its post.
function toPublicAddon(row: AddonWithServed, siteUrl: string): PublicAddon | undefined {
	const served = row.versions.at(0);

	if (!served) return;

	const icon = iconUrl(served.manifest.icon);

	return {
		id: row.id,
		type: row.type,
		name: row.name,
		description: row.description,
		version: served.version,
		authors: served.manifest.authors.map((author) => ({
			name: author.name,
			discordId: author.id,
		})),
		...(icon ? { iconUrl: icon } : {}),
		pageUrl: new URL(`/addons/${row.id}`, siteUrl).href,
		listed: row.delistedAt === null,
	};
}

/**
 * @description Reads one addon's public listing as it is now.
 * @param db The read database.
 * @param options The read options; `siteUrl` builds the page url.
 * @param id The addon id.
 * @returns The listing, or `undefined` when the addon is gone or serves no version.
 */
export async function readAddon(
	db: ReadDatabase,
	options: ResolvedReadOptions,
	id: string,
): Promise<PublicAddon | undefined> {
	const [row] = await queryAddons(db, id);

	return row ? toPublicAddon(row, options.siteUrl) : undefined;
}

/**
 * @description Reads every addon that serves a version, delisted ones included.
 * @param db The read database.
 * @param options The read options; `siteUrl` builds the page urls.
 * @returns The listings.
 */
export async function readAddons(
	db: ReadDatabase,
	options: ResolvedReadOptions,
): Promise<PublicAddon[]> {
	const rows = await queryAddons(db);

	return rows.flatMap((row) => toPublicAddon(row, options.siteUrl) ?? []);
}

export default { readAddon, readAddons };
