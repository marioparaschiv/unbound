import { describe, expect, test } from 'bun:test';

import { newerBundle } from '~/lib/debug-card/context';

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 14, 12, minutes));

const bundles = [
	{ version: 'ccccccccc111', minLoaderVersion: '1.6.0', publishedAt: at(30) },
	{ version: 'bbbbbbbbb111', minLoaderVersion: '1.4.0', publishedAt: at(20) },
	{ version: 'aaaaaaaaa111', minLoaderVersion: '1.4.0', publishedAt: at(10) },
];

describe('newerBundle', () => {
	test('names the newest bundle the loader runs', () => {
		expect(newerBundle(bundles, 'aaaaaaaaa', '1.5.0')).toBe('bbbbbbbbb');
	});

	test('skips bundles that need a newer loader', () => {
		expect(newerBundle(bundles, 'bbbbbbbbb', '1.5.0')).toBeUndefined();
		expect(newerBundle(bundles, 'bbbbbbbbb', '1.6.0')).toBe('ccccccccc');
	});

	test('reports nothing for the newest bundle or a build the channel never published', () => {
		expect(newerBundle(bundles, 'ccccccccc', '1.6.0')).toBeUndefined();
		expect(newerBundle(bundles, 'ddddddddd', '1.6.0')).toBeUndefined();
		expect(newerBundle(bundles, '', '1.6.0')).toBeUndefined();
	});
});
