import { describe, expect, test } from 'bun:test';

import { addMenuItemOnce, guildSheetId } from '~/menu/menu-targets';

describe('guildSheetId', () => {
	test('reads the guild from a server action sheet', () => {
		expect(guildSheetId('GuildActionSheet:1', { guild: { id: '1' } })).toBe('1');
	});

	test('falls back to the guildId prop and the sheet key', () => {
		expect(guildSheetId('GuildActionSheet:1', { guildId: '2' })).toBe('2');
		expect(guildSheetId('GuildActionSheet:3', {})).toBe('3');
	});

	test('ignores other sheets', () => {
		expect(guildSheetId('UserProfile1', { guild: { id: '1' } })).toBeUndefined();
		expect(guildSheetId('ChannelLongPressActionSheet', { guildId: '1' })).toBeUndefined();
	});
});

describe('addMenuItemOnce', () => {
	test('adds an item once', () => {
		const items = [{ label: 'Mark As Read' }];

		expect(addMenuItemOnce(items, { label: 'Apply' })).toBe(true);
		expect(addMenuItemOnce(items, { label: 'Apply' })).toBe(false);
		expect(items.map((item) => item.label)).toEqual(['Mark As Read', 'Apply']);
	});
});
