import type { SubmissionKind } from '@unbound-app/contracts/publish';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod/mini';

import { getArtifactKeys, getCdnUrl, pinSource, toVersionChangelog } from '~/lib/artifacts';
import type { MarketplaceAddonDetails } from '~/lib/marketplace';
import type { Permissions } from '~/lib/auth/access';
import { loadAuthors } from '~/lib/authors/resolve';
import { hasPermission } from '~/lib/auth/access';
import { resolveCaller } from '~/lib/api/caller';
import { renderAddonIcon } from '~/lib/addon-icons';
import { getAddonDetails } from '~/lib/addons';
import app from '~/lib/app';

const PREVIEW_PERMISSIONS: Record<SubmissionKind, Permissions> = {
	listing: { submission: ['review'] },
	update: { update: ['review'] },
};

const previewRequestSchema = z.object({
	addonId: z.string(),
	submissionId: z.uuid(),
});

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

		const [published, resolve] = await Promise.all([
			getAddonDetails(app, row.addonId),
			loadAuthors(app, [row.manifest.authors]),
		]);
		const keys = getArtifactKeys(row.addonId, row.version, row.manifest.main);
		const pin = pinSource(row.repository, row.source);
		const submittedAt = (row.submittedAt ?? row.createdAt).toISOString();
		const pending = {
			version: row.version,
			...toVersionChangelog(row.changelog, row.source),
			source: pin,
			bundleSize: row.bundleSize,
			sha256: row.sha256,
			publishedAt: submittedAt,
			manifestUrl: getCdnUrl(app.env, keys.manifest),
			bundleUrl: getCdnUrl(app.env, keys.bundle),
		};

		return {
			id: row.addonId,
			type: row.manifest.type ?? published?.type ?? 'plugin',
			name: row.manifest.name,
			description: row.manifest.description,
			iconSvg: renderAddonIcon(published?.icon),
			authors: resolve(row.manifest.authors),
			version: row.version,
			manifestUrl: pending.manifestUrl,
			createdAt: published?.createdAt ?? submittedAt,
			capabilities: row.manifest.capabilities ?? [],
			minClientVersion: row.manifest.unbound?.min ?? null,
			versions: [
				pending,
				...(published?.versions ?? []).map(
					({ manifest: _manifest, ...version }) => version,
				),
			],
			source: {
				pin,
				details: row.source.details,
				addonMd: row.source.addonMd,
				approvedAt: submittedAt,
			},
		};
	});

export default { fetchSubmissionPreview };
