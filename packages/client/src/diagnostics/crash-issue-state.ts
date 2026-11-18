import { REPOSITORY } from '~/core/repository';

import type { CrashRecord, IssueState } from './crash-history';

const CHECKED_PER_LAUNCH = 10;

/** A crash whose issue state to check: when it happened, its issue's number and the state last seen. */
export type IssueCheck = { at: number; number: number; state?: IssueState };

type IssuePayload = { state?: string; state_reason?: string | null };

function isIssuePayload(value: unknown): value is IssuePayload {
	return Boolean(value) && typeof value === 'object' && 'state' in (value as object);
}

/**
 * @description Reads whether a GitHub issue is open, closed as fixed, or closed for another reason.
 * @param payload The issue as GitHub's API returns it.
 * @returns The state, or `undefined` when the payload is not an issue.
 */
export function readIssueState(payload: IssuePayload): IssueState | undefined {
	const { state, state_reason: reason } = payload;

	if (state === 'open') {
		return 'open';
	}

	if (state !== 'closed') {
		return undefined;
	}

	return reason === 'completed' ? 'fixed' : 'closed';
}

/**
 * @description Picks the crashes whose issue state is worth checking again: linked ones not yet fixed, newest first.
 * @param records The crash history.
 * @returns At most ten checks.
 */
export function issuesToCheck(records: CrashRecord[]): IssueCheck[] {
	return records
		.flatMap((record) =>
			record.issue && record.issueState !== 'fixed'
				? [{ at: record.at, number: record.issue.number, state: record.issueState }]
				: [],
		)
		.toReversed()
		.slice(0, CHECKED_PER_LAUNCH);
}

async function fetchIssueState(number: number): Promise<IssueState | undefined> {
	try {
		const response = await fetch(
			`https://api.github.com/repos/${REPOSITORY}/issues/${number}`,
			{
				headers: { Accept: 'application/vnd.github+json' },
			},
		);

		const payload: unknown = response.ok ? await response.json() : undefined;

		return isIssuePayload(payload) ? readIssueState(payload) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * @description Checks the GitHub issues of recent crashes, saves their state, and says which turned fixed since the
 * last check, so the user hears about each fix once.
 * @returns The crashes whose issue was just closed as fixed.
 */
export async function refreshIssueStates(): Promise<IssueCheck[]> {
	const { markCrashReported, readCrashHistory } = await import('./crash-history');
	const fixed: IssueCheck[] = [];

	for (const check of issuesToCheck(await readCrashHistory())) {
		const state = await fetchIssueState(check.number);

		if (!state || state === check.state) {
			continue;
		}

		await markCrashReported(check.at, { issueState: state });

		if (state === 'fixed') {
			fixed.push(check);
		}
	}

	return fixed;
}
