import type {
	ListRepositoryAddonsResponse,
	PushableRepository,
	ListRepositoryAddonsQuery,
	RepositoryAddon,
} from '@unbound-app/contracts/source';
import type { Submission, SubmissionDetailsOverrides } from '@unbound-app/contracts/publish';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmissionPreview } from '@unbound-app/contracts/review';
import { useState } from 'react';

import {
	createSubmissionMutation,
	pushableRepositoriesQuery,
	repositoryAddonsQuery,
	submissionPreviewQuery,
	toPreviewRequest,
} from '~/queries/submissions/submissions';
import type { PreviewRequest } from '~/queries/submissions/submissions';
import getApiErrorMessage from '~/lib/api/error-message';
import type { PendingSource } from '~/lib/dashboard';

type SubmitFlowOptions = {
	/** Where the addon's last submission came from; read and previewed at once. */
	pendingSource?: PendingSource;
	onSubmitted: (submission: Submission) => void;
};

type SubmitFlow = {
	repositories: PushableRepository[];
	listing: ListRepositoryAddonsResponse | undefined;
	path: string | null;
	request: PreviewRequest | null;
	preview: SubmissionPreview | undefined;
	error: string | null;
	isPending: boolean;
	read: (source: ListRepositoryAddonsQuery) => void;
	pick: (addon: RepositoryAddon) => void;
	submit: (details: SubmissionDetailsOverrides) => void;
};

const SHORTCUT_LIMIT = 12;

/**
 * @description Drives the submit flow: read a repository at a ref, preview one of its addons, submit it.
 * @param options The source to start from and what to do once submitted.
 * @returns The listing, the picked addon's preview, the latest error and the action for each step.
 */
function useSubmitFlow({ pendingSource, onSubmitted }: SubmitFlowOptions): SubmitFlow {
	const queryClient = useQueryClient();
	const [source, setSource] = useState<ListRepositoryAddonsQuery | null>(
		pendingSource ? { repository: pendingSource.repository } : null,
	);
	const [path, setPath] = useState(pendingSource?.path ?? null);
	const repositories = useQuery(pushableRepositoriesQuery());
	const listing = useQuery(repositoryAddonsQuery(source));
	const request = toPreviewRequest(listing.data, path);
	const preview = useQuery(submissionPreviewQuery(request));
	const submission = useMutation(createSubmissionMutation());
	const isPending = listing.isFetching || preview.isFetching || submission.isPending;
	const error = isPending ? null : (listing.error ?? preview.error ?? submission.error);

	function read(next: ListRepositoryAddonsQuery) {
		// Re-reading the listing on screen picks up new commits; any other listing comes from the cache, where hovering may have just put it.
		if (next.repository === source?.repository && next.ref === source.ref) {
			void queryClient.invalidateQueries({
				queryKey: repositoryAddonsQuery(next).queryKey,
				exact: true,
			});
		}

		submission.reset();
		setSource(next);
		setPath(null);
	}

	function pick(addon: RepositoryAddon) {
		submission.reset();
		setPath(addon.path);

		if (addon.path === path && preview.isError) {
			void preview.refetch();
		}
	}

	function submit(details: SubmissionDetailsOverrides) {
		if (!request) return;

		submission.mutate({ ...request, details }, { onSuccess: onSubmitted });
	}

	return {
		repositories: repositories.data?.repositories.slice(0, SHORTCUT_LIMIT) ?? [],
		listing: listing.data,
		path,
		request,
		preview: preview.data,
		error: error ? getApiErrorMessage(error) : null,
		isPending,
		read,
		pick,
		submit,
	};
}

export default useSubmitFlow;
