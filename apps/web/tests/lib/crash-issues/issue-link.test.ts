import { describe, expect, test } from 'bun:test';

import { crashIssueUrl } from '~/lib/crash-issues/issue-link';

describe('crashIssueUrl', () => {
	test('points a short link at the crash issue', () => {
		expect(crashIssueUrl('owner/repo', '1234')).toBe(
			'https://github.com/owner/repo/issues/1234',
		);
	});

	test('rejects anything but a plain issue number', () => {
		for (const number of ['0', '12a', '../pulls', '', '1234567890']) {
			expect(crashIssueUrl('owner/repo', number)).toBeUndefined();
		}
	});
});
