import { queryOptions } from '@tanstack/react-query';

import { fetchSubmissionPreview } from '~/lib/submission-preview-functions';
import { fetchMarketplaceAddon } from '~/lib/marketplace';
import { marketplaceKey } from '~/queries/keys';

/**
 * @description A listed addon's public page.
 * @param id The addon id.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`; the data is `null` when it is not listed.
 */
export function addonQuery(id: string) {
	return queryOptions({
		queryKey: [...marketplaceKey, 'addon', id],
		queryFn: ({ signal }) => fetchMarketplaceAddon({ data: id, signal }),
	});
}

/**
 * @description The addon's page as it would look with a submission published, for reviewers.
 * @param id The addon id.
 * @param submissionId The submission to preview, or `undefined` for none.
 * @returns Options for `useSuspenseQuery` and `ensureQueryData`; the data is `null` without a submission
 * or when the viewer may not review it.
 */
export function submissionPreviewQuery(id: string, submissionId: string | undefined) {
	return queryOptions({
		queryKey: [...marketplaceKey, 'addon', id, 'preview', submissionId ?? null],
		queryFn: ({ signal }) =>
			submissionId
				? fetchSubmissionPreview({ data: { addonId: id, submissionId }, signal })
				: null,
	});
}

export default { addonQuery, submissionPreviewQuery };
