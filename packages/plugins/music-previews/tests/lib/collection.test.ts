import { describe, expect, test } from 'bun:test';

import { withSearches } from '~/lib/collection';

describe('collections', () => {
	test('gives songs without a clip an iTunes search', () => {
		expect(
			withSearches([
				{ title: 'One', subtitle: 'Band', preview: 'https://clip' },
				{ title: 'Two', subtitle: 'Band' },
			]),
		).toEqual([
			{ title: 'One', subtitle: 'Band', preview: 'https://clip' },
			{ title: 'Two', subtitle: 'Band', search: 'Two Band' },
		]);
	});
});
