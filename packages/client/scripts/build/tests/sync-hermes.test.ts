import { describe, expect, test } from 'bun:test';

import { nextBytecodeVersions, sameVersions } from '../sync-hermes';

const manifest = {
	latest: [99, 98, 96, 94],
	versions: {
		'94': { npm: '94.0.0' },
		'96': { npm: '96.0.0' },
		'98': { npm: '98.0.0' },
		'99': { npm: '99.0.0' },
	},
};

describe('sync-hermes', () => {
	test('adds newer published versions and never drops one that ships today', () => {
		expect(nextBytecodeVersions(manifest, [98, 96, 94])).toEqual([99, 98, 96, 94]);
		expect(nextBytecodeVersions(manifest, [98])).toEqual([99, 98]);
		expect(nextBytecodeVersions(manifest, [99, 98])).toEqual([99, 98]);
	});

	test('skips versions the manifest lists without a package', () => {
		expect(
			nextBytecodeVersions({ ...manifest, latest: [100, 99, 98, 96] }, [98, 96, 94]),
		).toEqual([99, 98, 96, 94]);
	});

	test('starts from the newest published version when none ships yet', () => {
		expect(nextBytecodeVersions(manifest, [])).toEqual([99]);
	});

	test('compares versions in order', () => {
		expect(sameVersions([98, 96], [98, 96])).toBe(true);
		expect(sameVersions([96, 98], [98, 96])).toBe(false);
		expect(sameVersions([98], [98, 96])).toBe(false);
	});
});
