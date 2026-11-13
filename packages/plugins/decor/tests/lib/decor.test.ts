import { describe, expect, test } from 'bun:test';

import { decorDecoration, decorImage, decorRequests } from '~/lib/decor';

describe('decor', () => {
	test('marks a decoration with the Decor SKU', () => {
		expect(decorDecoration('abc')).toEqual({ asset: 'abc', skuId: '100101099111114' });
	});

	test('links the still frame unless the decoration may animate', () => {
		expect(decorImage('a_abc')).toBe('https://ugc.decor.fieryflames.dev/abc.png');
		expect(decorImage('a_abc', true)).toBe('https://ugc.decor.fieryflames.dev/a_abc.png');
		expect(decorImage('abc', true)).toBe('https://ugc.decor.fieryflames.dev/abc.png');
	});

	test('asks for a hundred users per request', () => {
		const ids = Array.from({ length: 150 }, (_, index) => String(index));
		const requests = decorRequests(ids);

		expect(requests).toHaveLength(2);
		expect(decodeURIComponent(requests[1]!.split('ids=')[1]!)).toBe(
			JSON.stringify(ids.slice(100)),
		);
	});
});
