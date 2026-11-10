import type { RepositoryDetails, SourcePin } from '@unbound-app/contracts/source';
import type { AddonVersion } from '@unbound-app/contracts/addons';
import type { AddonPage } from '@unbound-app/contracts/addon-page';
import type { Changelog } from '@unbound-app/contracts/changelog';

import { getPinnedMediaBase, getPublishedMediaBase } from '~/lib/markdown-url';
import { toMarketplaceAddon, type MarketplaceAddon } from '~/lib/marketplace-addon';
import { readAddonTags, readTags, type AddonTag } from '~/lib/addon-tags';
import { resolvePlatforms, type PlatformSupport } from '~/lib/addon-platforms';
import { getAddonDetails, getManifestType, type AddonDetails } from '~/lib/addons';
import { pinSource, renderAddonVersion, toVersionChangelog } from '~/lib/artifacts';
import type { SourcedSubmissionRow } from '~/lib/submissions';
import { renderPageIcons } from '~/lib/page-icon-svgs';
import { loadAuthors } from '~/lib/authors/resolve';
import type { AppContext } from '~/lib/context';

export type MarketplaceVersion = Omit<AddonVersion, 'manifest'>;

/** Where the newest version was read from, and what it and GitHub said about it at submission. */
export type MarketplaceSource = {
	pin: SourcePin;
	details: RepositoryDetails;
	addonMd: string | null;
	/** The measured store page, or `null` when the version has none. */
	page: AddonPage | null;
	/** The directory URL ADDON.md's `media/` paths load from. */
	mediaBase: string;
	/** Each `:name:` icon ADDON.md uses, as `<svg>` markup by name, so the page ships only those. */
	icons: Record<string, string>;
	/** When the version was approved, which dates the `details` snapshot. */
	approvedAt: string;
};

export type MarketplaceAddonDetails = MarketplaceAddon & {
	createdAt: string;
	/** The platforms the newest version runs on, each with the Capabilities it needs there. */
	platforms: PlatformSupport[];
	/** The oldest Unbound version the newest version runs on. */
	minClientVersion: string | null;
	/** Newest first; the first is the one installs get. */
	versions: MarketplaceVersion[];
	/** `null` when the newest version predates GitHub sources. */
	source: MarketplaceSource | null;
	/** The site's tags it is filed under, in menu order. */
	tags: AddonTag[];
};

/** What a version would publish, read from a submission row or straight from GitHub. */
export type PendingVersion = {
	manifest: SourcedSubmissionRow['manifest'];
	changes: Changelog | null;
	pin: SourcePin;
	details: RepositoryDetails;
	addonMd: string | null;
	page: AddonPage | null;
	bundleSize: number;
	sha256: string;
	/** When it was submitted, or now for a source not yet submitted. */
	at: string;
	/** The icon it would set; `null` keeps the live addon's. */
	icon: string | null;
	/** The tag ids it would file the addon under; `null` keeps the live addon's. */
	tags: string[] | null;
};

// The page's top: the addon's summary fields, the version installs get and what it was read from.
type PageTop = {
	addon: Pick<AddonDetails, 'type' | 'name' | 'description' | 'icon'>;
	version: AddonVersion;
	source: MarketplaceSource | null;
};

/**
 * @description Reads a pending submission as the version approving it would publish.
 * @param row The submission with its GitHub source.
 * @returns The pending version.
 */
export function toPendingVersion(row: SourcedSubmissionRow): PendingVersion {
	return {
		manifest: row.manifest,
		changes: row.source.changelog,
		pin: pinSource(row.repository, row.source),
		details: row.source.details,
		addonMd: row.source.addonMd,
		page: row.source.page,
		bundleSize: row.bundleSize,
		sha256: row.sha256,
		at: (row.submittedAt ?? row.createdAt).toISOString(),
		icon: row.icon,
		tags: row.tags,
	};
}

function publishedTop(details: AddonDetails, version: AddonVersion): PageTop {
	return {
		addon: details,
		version,
		source:
			version.source && details.details
				? {
						pin: version.source,
						details: details.details,
						addonMd: details.addonMd,
						page: details.page,
						mediaBase: getPublishedMediaBase(version.manifestUrl),
						icons: renderPageIcons(details.addonMd ?? ''),
						approvedAt: version.publishedAt,
					}
				: null,
	};
}

// Approval copies the manifest's summary onto the addon, so the preview shows it the same way.
function pendingTop(
	ctx: AppContext,
	id: string,
	pending: PendingVersion,
	published: AddonDetails | undefined,
): PageTop {
	const { manifest, pin, at } = pending;

	return {
		addon: {
			type: getManifestType(manifest),
			name: manifest.name,
			description: manifest.description,
			icon: pending.icon ?? published?.icon ?? null,
		},
		version: renderAddonVersion(ctx.env, {
			addonId: id,
			version: manifest.version,
			manifest,
			...toVersionChangelog(null, { changelog: pending.changes }),
			source: pin,
			addonMd: pending.addonMd,
			bundleSize: pending.bundleSize,
			sha256: pending.sha256,
			publishedAt: at,
		}),
		source: {
			pin,
			details: pending.details,
			addonMd: pending.addonMd,
			page: pending.page,
			mediaBase: getPinnedMediaBase(pin),
			icons: renderPageIcons(pending.addonMd ?? ''),
			approvedAt: at,
		},
	};
}

function readPageTags(ctx: AppContext, id: string, pending: PendingVersion | undefined) {
	return pending?.tags
		? readTags(ctx, pending.tags)
		: readAddonTags(ctx, [id]).then((found) => found.get(id) ?? []);
}

/**
 * @description Loads an addon's public page, or with `pending` the page approving that version would
 * publish: the pending version on top of the listed addon's history.
 * @param ctx The application context.
 * @param id The addon id.
 * @param pending A version still in review, for a reviewer's or author's preview.
 * @returns The page, or `undefined` without `pending` when the addon is not listed.
 */
export async function loadAddonPage(
	ctx: AppContext,
	id: string,
	pending?: PendingVersion,
): Promise<MarketplaceAddonDetails | undefined> {
	const published = await getAddonDetails(ctx, id);
	const history = published?.versions ?? [];
	const served = history[0];
	const top = pending
		? pendingTop(ctx, id, pending, published)
		: published && served
			? publishedTop(published, served)
			: undefined;

	if (!top) return;

	const { manifest } = top.version;
	const [resolve, tags] = await Promise.all([
		loadAuthors(ctx, [manifest.authors]),
		readPageTags(ctx, id, pending),
	]);
	const versions = pending ? [top.version, ...history] : history;

	return {
		...toMarketplaceAddon({ id, ...top.addon }, top.version, resolve),
		createdAt: published?.createdAt ?? top.version.publishedAt,
		platforms: resolvePlatforms(manifest),
		minClientVersion: manifest.unbound?.min ?? null,
		versions: versions.map(({ manifest: _manifest, ...version }) => version),
		source: top.source,
		tags,
	};
}

export default { toPendingVersion, loadAddonPage };
