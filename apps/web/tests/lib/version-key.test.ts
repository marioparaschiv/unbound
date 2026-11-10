import { describe, expect, test } from 'bun:test';

import { toVersionKey } from '~/lib/version-key';

// The SemVer 2.0.0 precedence example, plus multi-digit and mixed-identifier cases and loader commit-count patches.
const ascending = [
	'0.9.0',
	'1.0.0-alpha',
	'1.0.0-alpha.1',
	'1.0.0-alpha.beta',
	'1.0.0-alpha-x',
	'1.0.0-beta',
	'1.0.0-beta.2',
	'1.0.0-beta.11',
	'1.0.0-rc.1',
	'1.0.0',
	'1.0.1',
	'1.0.99',
	'1.0.962',
	'1.0.1003',
	'1.2.0',
	'1.10.0',
	'2.0.0-0',
	'2.0.0-1',
	'2.0.0-10',
	'2.0.0-a',
	'2.0.0',
	'10.0.0',
	'100.0.0',
];

function byKey(a: string, b: string): number {
	const left = toVersionKey(a);
	const right = toVersionKey(b);

	return left < right ? -1 : left > right ? 1 : 0;
}

describe('toVersionKey', () => {
	test('orders versions by semver precedence', () => {
		const shuffled = ascending.toReversed();

		expect(shuffled.toSorted(byKey)).toEqual(ascending);
		expect(shuffled.toSorted(Bun.semver.order)).toEqual(ascending);
	});

	test('ignores build metadata', () => {
		expect(toVersionKey('1.2.3+build.5')).toBe(toVersionKey('1.2.3'));
	});
});
