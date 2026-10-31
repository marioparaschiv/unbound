import type { RepositoryDetails, SourcePin } from '@unbound-app/contracts/source';
import { createSubmissionRequestSchema } from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { SubmissionKind } from '@unbound-app/contracts/publish';
import type { Changelog } from '@unbound-app/contracts/changelog';
import type { AddonPage } from '@unbound-app/contracts/addon-page';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod/mini';

import { getArtifactKeys, getCdnUrl, pinSource, toVersionChangelog } from '~/lib/artifacts';
import type { MarketplaceAddonDetails } from '~/lib/marketplace';
import { resolvePlatforms } from '~/lib/addon-platforms';
import { getPinnedMediaBase } from '~/lib/markdown-url';
import { previewSubmission } from '~/lib/submissions';
import type { Permissions } from '~/lib/auth/access';
import { renderAddonIcon } from '~/lib/addon-icons';
import { loadAuthors } from '~/lib/authors/resolve';
import { hasPermission } from '~/lib/auth/access';
import { resolveCaller } from '~/lib/api/caller';
import { readAddonTags, readTags } from '~/lib/addon-tags';
import { getAddonDetails } from '~/lib/addons';
import app from '~/lib/app';

/** What a version would publish, read from a submission row or straight from GitHub. */
type PendingVersion = {
	addonId: string;
	manifest: PublishedManifest;
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

const PREVIEW_PERMISSIONS: Record<SubmissionKind, Permissions> = {
	listing: { submission: ['review'] },
	update: { update: ['review'] },
};

const previewRequestSchema = z.object({
	addonId: z.string(),
	submissionId: z.uuid(),
});

// The pinned source plus the form's unsaved choices, so the preview shows what submitting now would.
const sourcePreviewRequestSchema = z.extend(
	z.omit(createSubmissionRequestSchema, { details: true }),
	{
		icon: z.optional(z.string()),
		tags: z.optional(z.array(z.string())),
	},
);

// The live addon's page with the pending version on top, as approving it would publish.
async function toPreviewPage(pending: PendingVersion): Promise<MarketplaceAddonDetails> {
	const { addonId, manifest, pin, at } = pending;
	const [published, resolve, tags] = await Promise.all([
		getAddonDetails(app, addonId),
		loadAuthors(app, [manifest.authors]),
		pending.tags
			? readTags(app, pending.tags)
			: readAddonTags(app, [addonId]).then((found) => found.get(addonId) ?? []),
	]);
	const keys = getArtifactKeys(addonId, manifest.version, manifest.main);
	const version = {
		version: manifest.version,
		...toVersionChangelog(null, { changelog: pending.changes }),
		source: pin,
		bundleSize: pending.bundleSize,
		sha256: pending.sha256,
		publishedAt: at,
		manifestUrl: getCdnUrl(app.env, keys.manifest),
		bundleUrl: getCdnUrl(app.env, keys.bundle),
	};

	return {
		id: addonId,
		type: manifest.type ?? published?.type ?? 'plugin',
		name: manifest.name,
		description: manifest.description,
		iconSvg: renderAddonIcon(pending.icon ?? published?.icon),
		authors: resolve(manifest.authors),
		version: manifest.version,
		manifestUrl: version.manifestUrl,
		createdAt: published?.createdAt ?? at,
		platforms: resolvePlatforms(manifest),
		minClientVersion: manifest.unbound?.min ?? null,
		versions: [
			version,
			...(published?.versions ?? []).map(({ manifest: _manifest, ...entry }) => entry),
		],
		source: {
			pin,
			details: pending.details,
			addonMd: pending.addonMd,
			page: pending.page,
			mediaBase: getPinnedMediaBase(pin),
			approvedAt: at,
		},
		tags,
	};
}

/**
 * @description Builds the public addon page as it would look with a submission published, for reviewers.
 * @returns The page data, or `null` when the caller may not review that submission or it is not this addon's.
 */
export const fetchSubmissionPreview = createServerFn({ method: 'GET' })
	.validator(previewRequestSchema)
	.handler(async ({ data }): Promise<MarketplaceAddonDetails | null> => {
		const caller = await resolveCaller(app, getRequestHeaders());

		if (!caller) return null;

		const row = await app.db.query.submission.findFirst({
			where: { id: data.submissionId, addonId: data.addonId },
			with: { source: true },
		});

		if (!row?.source || !row.repository || !row.sha256) return null;

		if (!hasPermission(caller.user.role, PREVIEW_PERMISSIONS[row.kind])) return null;

		return toPreviewPage({
			addonId: row.addonId,
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
		});
	});

/**
 * @description Builds the public addon page as submitting an addon from GitHub would publish it, for its author.
 * @returns The page data, or `null` when nobody is signed in. Throws what submitting would refuse.
 */
export const fetchSourcePreview = createServerFn({ method: 'GET' })
	.validator(sourcePreviewRequestSchema)
	.handler(async ({ data }): Promise<MarketplaceAddonDetails | null> => {
		const caller = await resolveCaller(app, getRequestHeaders());

		if (!caller) return null;

		const { icon, tags, ...source } = data;
		// Passing the choices as details runs the same checks submitting them would.
		const { preview } = await previewSubmission(app, caller, {
			...source,
			details: { icon, tags },
		});

		return toPreviewPage({
			addonId: preview.manifest.id,
			manifest: preview.manifest,
			changes: preview.changelog,
			pin: preview.source,
			details: preview.details,
			addonMd: preview.addonMd,
			page: preview.page,
			bundleSize: preview.bundleSize,
			sha256: preview.sha256,
			at: new Date().toISOString(),
			icon: icon ?? null,
			tags: tags ?? null,
		});
	});

export default { fetchSubmissionPreview, fetchSourcePreview };
