import { describe, expect, test } from 'bun:test';

import { missingSources } from '~/addons/missing-sources';

describe('missingSources', () => {
	test('lists installed addons whose files did not load', () => {
		const sources = { a: 'https://x/a.json', b: 'https://x/b.json', c: '' };

		expect(missingSources(sources, new Set(['a']))).toEqual([['b', 'https://x/b.json']]);
	});

	test('lists nothing when every addon loaded', () => {
		expect(missingSources({ a: 'https://x/a.json' }, new Set(['a']))).toEqual([]);
	});
});
