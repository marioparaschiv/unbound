import { describe, expect, test } from 'bun:test';

import { fitHeader } from '~/lib/header-fit';
import type { Message } from '~/lib/modules';

function header(): Message {
	return {
		id: '1',
		username: 'adrián (@dylib.dev)',
		timestamp: 'Yesterday at 21:04',
		roleIcon: { source: 'https://cdn.discordapp.com/badge-icons/a.png', size: 18 },
		clanTag: '말랑볼살',
		clanBadgeUrl: 'https://cdn.discordapp.com/clan-badges/a.png',
		clanTagGuildId: '2',
		tagText: 'Owner',
		tagAccessibilityLabel: 'Owner',
	};
}

describe('fitHeader', () => {
	test('keeps every item when the embed is wide enough', () => {
		const row = header();

		expect(fitHeader(row, 600)).toEqual([]);
		expect(row.tagText).toBe('Owner');
	});

	test('drops the role icon first', () => {
		const row = header();

		expect(fitHeader(row, 380)).toEqual(['roleIcon']);
		expect(row.clanTag).toBe('말랑볼살');
	});

	test('drops the clan tag before the user tag', () => {
		const row = header();

		expect(fitHeader(row, 320)).toEqual([
			'roleIcon',
			'clanTag',
			'clanBadgeUrl',
			'clanTagGuildId',
		]);
		expect(row.tagText).toBe('Owner');
	});

	test('keeps the name and timestamp in a narrow bubble', () => {
		const row = header();

		fitHeader(row, 263);

		expect(row.tagText).toBeUndefined();
		expect(row.username).toBe('adrián (@dylib.dev)');
		expect(row.timestamp).toBe('Yesterday at 21:04');
	});
});
