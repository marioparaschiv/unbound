import { getCdnUrl, getVersionDirectory } from '@unbound-app/contracts/version-layout';
import type { AddonPage } from '@unbound-app/contracts/addon-page';
import type { AddonType } from '@unbound-app/contracts/addons';

import type { ReadDatabase, ResolvedReadOptions } from '~/lib/bot/reads';
import type { PublicAddon, PublicGalleryImage } from '~/lib/bot/types';
import { renderAddonIcon } from '~/lib/addon-icons';
import { SERVED_VERSION } from '~/lib/addon-visibility';
import { getTreeUrl } from '~/lib/github-urls';

type AddonWithServed = Awaited<ReturnType<typeof queryAddons>>[number];

// The listing's fields and its newest live version, shared by the one-addon and every-addon reads.
const LISTING = {
	columns: { id: true, type: true, name: true, description: true, icon: true, delistedAt: true },
	with: {
		versions: {
			...SERVED_VERSION,
			columns: { version: true, manifest: true },
			// Only the columns provision.sql grants the bot: never the bundle, ADDON.md or review details.
			with: {
				submission: {
					columns: { repository: true },
					with: { source: { columns: { path: true, commitSha: true, page: true } } },
				},
			},
		},
	},
} as const;

// The website shows a plug or a palette when maintainers picked no icon; `renderAddonIcon` knows both.
const DEFAULT_ICONS: Record<AddonType, string> = {
	plugin: 'IconPlug',
	theme: 'IconPalette',
	'icon-pack': 'IconPlug',
	font: 'IconPlug',
};

function queryAddons(db: ReadDatabase) {
	return db.query.addon.findMany(LISTING);
}

function iconSvg(row: AddonWithServed): string {
	return renderAddonIcon(row.icon) ?? renderAddonIcon(DEFAULT_ICONS[row.type]) ?? '';
}

// Media sits beside the manifest in the version's CDN folder; a video without a poster has no still to show.
function toGallery(page: AddonPage | null | undefined, folder: string): PublicGalleryImage[] {
	if (!page) {
		return [];
	}

	const measured = new Map(page.media.map((media) => [media.path, media]));

	return page.frontmatter.media.flatMap((entry) => {
		const path = 'image' in entry ? entry.image : entry.poster;
		const media = path ? measured.get(path) : undefined;

		if (!media) {
			return [];
		}

		return [
			{
				url: new URL(media.path, folder).href,
				width: media.width,
				height: media.height,
				alt: entry.alt,
			},
		];
	});
}

// An addon with no live version has nothing to show, so the bot removes its post.
function toPublicAddon(
	row: AddonWithServed,
	options: ResolvedReadOptions,
): PublicAddon | undefined {
	const served = row.versions.at(0);

	if (!served) return;

	const { repository, source } = served.submission ?? {};
	const folder = getCdnUrl(options.cdnUrl, `${getVersionDirectory(row.id, served.version)}/`);

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
		iconSvg: iconSvg(row),
		pageUrl: new URL(`/addons/${row.id}`, options.siteUrl).href,
		installUrl: new URL(`/install/${row.id}`, options.siteUrl).href,
		...(repository && source
			? {
					sourceUrl: getTreeUrl({
						repository,
						commitSha: source.commitSha,
						path: source.path,
					}),
				}
			: {}),
		gallery: toGallery(source?.page, folder),
		listed: row.delistedAt === null,
	};
}

/**
 * @description Reads one addon's public listing as it is now.
 * @param db The read database.
 * @param options The read options; `siteUrl` and `cdnUrl` build the links.
 * @param id The addon id.
 * @returns The listing, or `undefined` when the addon is gone or serves no version.
 */
export async function readAddon(
	db: ReadDatabase,
	options: ResolvedReadOptions,
	id: string,
): Promise<PublicAddon | undefined> {
	const row = await db.query.addon.findFirst({ ...LISTING, where: { id } });

	return row ? toPublicAddon(row, options) : undefined;
}

/**
 * @description Reads every addon that serves a version, delisted ones included.
 * @param db The read database.
 * @param options The read options; `siteUrl` and `cdnUrl` build the links.
 * @returns The listings.
 */
export async function readAddons(
	db: ReadDatabase,
	options: ResolvedReadOptions,
): Promise<PublicAddon[]> {
	const rows = await queryAddons(db);

	return rows.flatMap((row) => toPublicAddon(row, options) ?? []);
}

export default { readAddon, readAddons };
