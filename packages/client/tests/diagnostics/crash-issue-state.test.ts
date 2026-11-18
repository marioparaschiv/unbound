import { describe, expect, test } from 'bun:test';

import { issuesToCheck, readIssueState } from '~/diagnostics/crash-issue-state';

describe('crash issue state', () => {
	test('reads open, fixed and otherwise closed issues', () => {
		expect(readIssueState({ state: 'open' })).toBe('open');
		expect(readIssueState({ state: 'closed', state_reason: 'completed' })).toBe('fixed');
		expect(readIssueState({ state: 'closed', state_reason: 'not_planned' })).toBe('closed');
		expect(readIssueState({ state: 'merged' })).toBeUndefined();
	});

	test('checks linked crashes not yet fixed, newest first', () => {
		const issue = (number: number) => ({
			number,
			url: `https://github.com/o/r/issues/${number}`,
		});

		expect(
			issuesToCheck([
				{ at: 1, kind: 'crash', message: 'a', issue: issue(1), issueState: 'fixed' },
				{ at: 2, kind: 'crash', message: 'b' },
				{ at: 3, kind: 'crash', message: 'c', issue: issue(3) },
				{ at: 4, kind: 'crash', message: 'd', issue: issue(4), issueState: 'open' },
			]),
		).toEqual([
			{ at: 4, number: 4, state: 'open' },
			{ at: 3, number: 3, state: undefined },
		]);
	});
});
