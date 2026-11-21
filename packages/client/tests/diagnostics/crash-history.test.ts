import { describe, expect, test } from 'bun:test';

import { shareCrashIssues, type CrashRecord } from '~/diagnostics/crash-history';

const crash = (at: number, extra: Partial<CrashRecord> = {}): CrashRecord => ({
	at,
	kind: 'native-crash',
	message: 'SIGTRAP',
	where: 'Discord',
	...extra,
});

describe('shareCrashIssues', () => {
	test('links an unsent repeat to the issue of the same crash', () => {
		const issue = { number: 2079, url: 'https://github.com/unbound-app/unbound/issues/2079' };
		const [filed, repeat] = shareCrashIssues([
			crash(1, { issue, issueState: 'open', reportId: 'r1' }),
			crash(2, { issuePending: true }),
		]);

		expect(filed?.issue).toEqual(issue);
		expect(repeat).toMatchObject({ issue, issueState: 'open', issuePending: false });
	});

	test('leaves other crashes and already linked records alone', () => {
		const own = { number: 1, url: 'https://github.com/unbound-app/unbound/issues/1' };
		const other = { number: 2, url: 'https://github.com/unbound-app/unbound/issues/2' };
		const records = shareCrashIssues([
			crash(1, { issue: other }),
			crash(2, { issue: own }),
			crash(3, { where: 'UIKitCore' }),
			crash(4, { addon: 'plugins:unbound.translate' }),
		]);

		expect(records.map((record) => record.issue?.number)).toEqual([2, 1, undefined, undefined]);
	});

	test('picks the newest issue of a crash whatever the order', () => {
		const old = { number: 1, url: 'https://github.com/unbound-app/unbound/issues/1' };
		const fresh = { number: 2, url: 'https://github.com/unbound-app/unbound/issues/2' };
		const [, , repeat] = shareCrashIssues([
			crash(5, { issue: fresh }),
			crash(1, { issue: old }),
			crash(9),
		]);

		expect(repeat?.issue).toEqual(fresh);
	});
});
