import type { ApiErrorCode } from '@unbound-app/contracts/errors';

import type { ApiErrorDetails } from '~/lib/api/error-details';

/** `warning` for failures that are not the author's to fix, such as GitHub being down. */
export type SubmitErrorTone = 'error' | 'warning';

/** How the submit form explains one failure. */
export type SubmitErrorCopy = {
	title: string;
	/** What to do next; `null` shows the server's message, for codes whose message is the explanation. */
	hint: string | null;
	tone: SubmitErrorTone;
	link?: {
		to: '/dashboard' | '/account';
		label: string;
	};
};

/** The copy of a failure as the form shows it, with the server's message to keep behind Details. */
export type SubmitErrorView = SubmitErrorCopy & {
	hint: string;
	/** `null` when the hint already is the server's message. */
	details: string | null;
};

type SubmitErrorCode = Extract<
	ApiErrorCode,
	| 'artifact_missing'
	| 'artifact_too_large'
	| 'invalid_manifest'
	| 'invalid_changelog'
	| 'version_exists'
	| 'pending_update_exists'
	| 'pending_listing_cap'
	| 'addon_id_taken'
	| 'not_maintainer'
	| 'rate_limited'
	| 'account_too_new'
	| 'github_not_linked'
	| 'github_no_push_access'
	| 'github_unavailable'
	| 'repository_not_found'
	| 'ref_not_found'
	| 'source_changed'
	| 'invalid_request'
	| 'forbidden'
>;

const SUBMIT_ERRORS: Record<SubmitErrorCode, SubmitErrorCopy> = {
	artifact_missing: {
		title: 'Bundle not committed',
		hint: 'Build the addon and commit its output, or pick a commit or release branch that has it.',
		tone: 'error',
	},
	artifact_too_large: {
		title: 'Bundle too large',
		hint: 'Make the bundle smaller, commit it, and read the repository again.',
		tone: 'error',
	},
	invalid_manifest: {
		title: 'manifest.json needs fixing',
		hint: 'Fix the fields named in Details, commit, and read the repository again.',
		tone: 'error',
	},
	invalid_changelog: {
		title: 'CHANGELOG.md needs fixing',
		hint: 'Fix the lines named in Details, commit, and read the repository again.',
		tone: 'error',
	},
	version_exists: {
		title: 'Up to date',
		hint: 'Bump the version in manifest.json and commit it to submit an update.',
		tone: 'warning',
	},
	pending_update_exists: {
		title: 'Update already in review',
		hint: 'Wait for reviewers to decide on it before submitting another.',
		tone: 'warning',
		link: { to: '/dashboard', label: 'See it on your dashboard' },
	},
	pending_listing_cap: {
		title: 'Too many new listings in review',
		hint: 'Wait for reviewers to decide on one of your new listings first.',
		tone: 'warning',
		link: { to: '/dashboard', label: 'See them on your dashboard' },
	},
	addon_id_taken: {
		title: 'Addon ID taken',
		hint: 'Another submission already claims this ID. Pick another ID in manifest.json.',
		tone: 'error',
	},
	not_maintainer: {
		title: 'Not your addon',
		hint: 'Only its maintainers can submit updates. Ask an owner to add you by your User ID.',
		tone: 'error',
		link: { to: '/dashboard', label: 'Find your User ID' },
	},
	rate_limited: {
		title: 'Too many submissions',
		hint: 'Wait a while, then try again.',
		tone: 'warning',
	},
	account_too_new: { title: 'Discord account too new', hint: null, tone: 'warning' },
	github_not_linked: {
		title: 'GitHub not linked',
		hint: 'Link your GitHub account so the site can read your repositories.',
		tone: 'error',
		link: { to: '/account', label: 'Link GitHub' },
	},
	github_no_push_access: {
		title: 'No push access',
		hint: 'Submit from a repository your linked GitHub account can push to.',
		tone: 'error',
	},
	github_unavailable: {
		title: 'GitHub is not answering',
		hint: 'This is on GitHub’s side. Try again in a few minutes.',
		tone: 'warning',
	},
	repository_not_found: {
		title: 'Repository not found',
		hint: 'Check the owner and name, and that the repository is public.',
		tone: 'error',
	},
	ref_not_found: {
		title: 'Branch, tag or commit not found',
		hint: 'Check the name, push it if it is only local, then read again.',
		tone: 'error',
	},
	source_changed: {
		title: 'The branch moved',
		hint: 'Read the repository again to pick up its new commit.',
		tone: 'warning',
	},
	invalid_request: { title: 'Check your submission', hint: null, tone: 'error' },
	forbidden: { title: 'Not allowed', hint: null, tone: 'error' },
};

const UNKNOWN_ERROR: SubmitErrorCopy = { title: 'Something went wrong', hint: null, tone: 'error' };

function isSubmitErrorCode(code: ApiErrorCode): code is SubmitErrorCode {
	return Object.hasOwn(SUBMIT_ERRORS, code);
}

/**
 * @description Picks the plain-language copy for a failure in the submit flow.
 * @param error The failure's code and the server's message.
 * @returns The title, hint, tone and link, with the server's message kept as details.
 */
export function describeSubmitError(error: ApiErrorDetails): SubmitErrorView {
	const copy =
		error.code && isSubmitErrorCode(error.code) ? SUBMIT_ERRORS[error.code] : UNKNOWN_ERROR;

	return copy.hint === null
		? { ...copy, hint: error.message, details: null }
		: { ...copy, hint: copy.hint, details: error.message };
}

export default { describeSubmitError };
