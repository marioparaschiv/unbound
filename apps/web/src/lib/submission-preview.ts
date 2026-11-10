import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';

import {
	loadAddonPage,
	toPendingVersion,
	type MarketplaceAddonDetails,
	type PendingVersion,
} from '~/lib/marketplace-page';
import { isSourced, previewSubmission } from '~/lib/submissions';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { canReview } from '~/lib/review';

export type SubmissionPreviewRequest = {
	addonId: string;
	submissionId: string;
};

/** The pinned source plus the submit form's unsaved choices. */
export type SourcePreviewRequest = Omit<CreateSubmissionRequest, 'details'> & {
	icon?: string;
	tags?: string[];
};

/**
 * @description Builds the public addon page as it would look with a submission published, for reviewers.
 * @param ctx The application context.
 * @param caller The reviewer.
 * @param request The addon and the submission to publish on it.
 * @returns The page, or `undefined` when the caller may not review that submission or it is not this addon's.
 */
export async function loadSubmissionPreview(
	ctx: AppContext,
	caller: Caller,
	request: SubmissionPreviewRequest,
): Promise<MarketplaceAddonDetails | undefined> {
	const row = await ctx.db.query.submission.findFirst({
		where: { id: request.submissionId, addonId: request.addonId },
		with: { source: true },
	});

	if (!row || !isSourced(row)) return;

	if (!canReview(caller, row.kind)) return;

	return loadAddonPage(ctx, row.addonId, toPendingVersion(row));
}

/**
 * @description Builds the public addon page as submitting an addon from GitHub would publish it, for
 * its author. Throws what submitting would refuse.
 * @param ctx The application context.
 * @param caller The author.
 * @param request The pinned source and the form's unsaved choices.
 * @returns The page.
 */
export async function loadSourcePreview(
	ctx: AppContext,
	caller: Caller,
	request: SourcePreviewRequest,
): Promise<MarketplaceAddonDetails | undefined> {
	const { icon, tags, ...source } = request;
	// Passing the choices as details runs the same checks submitting them would.
	const { preview } = await previewSubmission(ctx, caller, {
		...source,
		details: { icon, tags },
	});
	const pending: PendingVersion = {
		manifest: preview.manifest,
		changes: preview.changelog,
		pin: preview.source,
		details: preview.details,
		addonMd: preview.addonMd,
		page: preview.page,
		bundleSize: preview.bundleSize,
		sha256: preview.sha256,
		at: ctx.now().toISOString(),
		icon: icon ?? null,
		tags: tags ?? null,
	};

	return loadAddonPage(ctx, preview.manifest.id, pending);
}

export default { loadSubmissionPreview, loadSourcePreview };
