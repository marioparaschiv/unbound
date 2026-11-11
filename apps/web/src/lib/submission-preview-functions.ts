import { createSubmissionRequestSchema } from '@unbound-app/contracts/publish';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import { Type } from '@unbound-app/contracts/schema';

import { loadSourcePreview, loadSubmissionPreview } from '~/lib/submission-preview';
import type { MarketplaceAddonDetails } from '~/lib/marketplace-page';
import { schemaValidator } from '~/lib/schema-validator';
import { resolveCaller } from '~/lib/api/caller';
import { getApp } from '~/lib/app';

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
		const app = getApp();
		const caller = await resolveCaller(app, getRequestHeaders());

		if (!caller) return null;

		return (await loadSubmissionPreview(app, caller, data)) ?? null;
	});

/**
 * @description Builds the public addon page as submitting an addon from GitHub would publish it, for its author.
 * @returns The page data, or `null` when nobody is signed in. Throws what submitting would refuse.
 */
export const fetchSourcePreview = createServerFn({ method: 'GET' })
	.validator(schemaValidator(sourcePreviewRequestSchema))
	.handler(async ({ data }): Promise<MarketplaceAddonDetails | null> => {
		const app = getApp();
		const caller = await resolveCaller(app, getRequestHeaders());

		if (!caller) return null;

		return (await loadSourcePreview(app, caller, data)) ?? null;
	});

export default { fetchSubmissionPreview, fetchSourcePreview };
