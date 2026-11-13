import { describe, expect, test } from 'bun:test';

import { describeCreated, describeList } from '~/lib/invites';

describe('invites', () => {
	test('describes a new invite with a relative expiry and its use limit', () => {
		expect(
			describeCreated({ code: 'abc', expires_at: '2026-11-20T00:00:00.000Z', max_uses: 5 }),
		).toBe('discord.gg/abc · Expires: <t:1795132800:R> · Max uses: `5`');
	});

	test('lists invites with their uses, or says there are none', () => {
		expect(describeList([{ code: 'a', uses: 1, max_uses: 5 }])).toBe(
			'discord.gg/a · Expires: never · Used: `1/5`',
		);
		expect(describeList([])).toBe('You have no active friend invites.');
	});
});
