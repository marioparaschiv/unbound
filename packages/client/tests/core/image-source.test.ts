import { describe, expect, test } from 'bun:test';

import { fixImageSource } from '~/core/image-source';

describe('fixImageSource', () => {
	test('turns a numeric uri into a string', () => {
		expect(fixImageSource({ uri: 42 })).toEqual({ uri: '42' });
	});

	test('returns string sources, asset ids and empty sources unchanged', () => {
		const source = { uri: 'https://cdn.discordapp.com/a.png' };

		expect(fixImageSource(source)).toBe(source);
		expect(fixImageSource(7)).toBe(7);
		expect(fixImageSource(undefined)).toBeUndefined();
		expect(fixImageSource({})).toEqual({});
	});

	test('fixes a list only when one of its sources needs it', () => {
		const good = [{ uri: 'a' }, { uri: 'b' }];

		expect(fixImageSource(good)).toBe(good);
		expect(fixImageSource([{ uri: 'a' }, { uri: 3 }])).toEqual([{ uri: 'a' }, { uri: '3' }]);
	});
});
