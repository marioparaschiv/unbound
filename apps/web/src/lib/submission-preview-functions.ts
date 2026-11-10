import { createSubmissionRequestSchema } from '@unbound-app/contracts/publish';
import type { SubmissionKind } from '@unbound-app/contracts/publish';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import { Type } from '@unbound-app/contracts/schema';

import {
	loadAddonPage,
	toPendingVersion,
	type MarketplaceAddonDetails,
} from '~/lib/marketplace-page';
import { schemaValidator } from '~/lib/schema-validator';
import { previewSubmission } from '~/lib/submissions';
import type { Permissions } from '~/lib/auth/access';
import { hasPermission } from '~/lib/auth/access';
import { resolveCaller } from '~/lib/api/caller';
import app from '~/lib/app';

const PREVIEW_PERMISSIONS: Record<SubmissionKind, Permissions> = {
	listing: { submission: ['review'] },
	update: { update: ['review'] },
};

const previewRequestSchema = Type.Object({
	addonId: Type.String(),
	submissionId: Type.String({ format: 'uuid' }),
});

// The pinned source plus the form's unsaved choices, so the preview shows what submitting now would.
const sourcePreviewRequestSchema = Type.Object({
	...Type.Omit(createSubmissionRequestSchema, ['details']).properties,
	icon: Type.Optional(Type.String()),
	tags: Type.Optional(Type.Array(Type.String())),
});

/**
 * @description Builds the public addon page as it would look with a submission published, for reviewers.
 * @returns The page data, or `null` when the caller may not review that submission or it is not this addon's.
 */
export const fetchSubmissionPreview = createServerFn({ method: 'GET' })
	.validator(schemaValidator(previewRequestSchema))
	.handler(async ({ data }): Promise<MarketplaceAddonDetails | null> => {
		const caller = await resolveCaller(app, getRequestHeaders());

		if (!caller) return null;

		const row = await app.db.query.submission.findFirst({
			where: { id: data.submissionId, addonId: data.addonId },
			with: { source: true },
		});

		if (!row?.source || !row.repository || !row.sha256) return null;

		if (!hasPermission(caller.user.role, PREVIEW_PERMISSIONS[row.kind])) return null;

		const { repository, sha256, source } = row;
		const pending = toPendingVersion({ ...row, repository, sha256, source });

		return (await loadAddonPage(app, row.addonId, pending)) ?? null;
	});

/**
 * @description Builds the public addon page as submitting an addon from GitHub would publish it, for its author.
 * @returns The page data, or `null` when nobody is signed in. Throws what submitting would refuse.
 */
export const fetchSourcePreview = createServerFn({ method: 'GET' })
	.validator(schemaValidator(sourcePreviewRequestSchema))
	.handler(async ({ data }): Promise<MarketplaceAddonDetails | null> => {
		const caller = await resolveCaller(app, getRequestHeaders());

		if (!caller) return null;

		const { icon, tags, ...source } = data;
		// Passing the choices as details runs the same checks submitting them would.
		const { preview } = await previewSubmission(app, caller, {
			...source,
			details: { icon, tags },
		});
		const pending = {
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
		};

		return (await loadAddonPage(app, preview.manifest.id, pending)) ?? null;
	});

export default { fetchSubmissionPreview, fetchSourcePreview };
