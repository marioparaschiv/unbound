import { describe, expect, test } from 'bun:test';

import { greetStickers } from '~/lib/stickers';

const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const pickBy = (offset: number) => (messageId: string) =>
	list[Number((BigInt(messageId) >> 22n) + BigInt(offset)) % list.length];

describe('greet stickers', () => {
	test('walks the whole list once, from whichever sticker the user starts on', () => {
		expect(greetStickers(pickBy(0)).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
		expect(greetStickers(pickBy(1)).map(({ id }) => id)).toEqual(['b', 'c', 'a']);
	});

	test('gives nothing when Discord picks nothing', () => {
		expect(greetStickers(() => undefined)).toEqual([]);
	});
});
