import { afterEach, describe, expect, test } from 'bun:test';

import { findFirstMessageId, forgetFirstMessages } from '~/lib/first-message';

afterEach(forgetFirstMessages);

describe('first message lookup', () => {
	test('asks once per channel and remembers the answer', async () => {
		const asked: string[] = [];
		const fetchOldest = async (channelId: string) => {
			asked.push(channelId);

			return { body: [{ id: '709090967960944722' }] };
		};

		expect(await findFirstMessageId('1', fetchOldest)).toBe('709090967960944722');
		expect(await findFirstMessageId('1', fetchOldest)).toBe('709090967960944722');
		expect(asked).toEqual(['1']);
	});

	test('leaves an empty channel unremembered', async () => {
		let asks = 0;
		const fetchOldest = async () => {
			asks += 1;

			return { body: [] };
		};

		expect(await findFirstMessageId('2', fetchOldest)).toBeUndefined();
		expect(await findFirstMessageId('2', fetchOldest)).toBeUndefined();
		expect(asks).toBe(2);
	});

	test('ignores a malformed page', async () => {
		expect(await findFirstMessageId('3', async () => ({ body: { id: '4' } }))).toBeUndefined();
	});
});
