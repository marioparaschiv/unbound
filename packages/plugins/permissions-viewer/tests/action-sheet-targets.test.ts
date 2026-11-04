import { describe, expect, test } from 'bun:test';

import { asId, sheetTarget } from '~/viewer/action-sheets/targets';

describe('sheetTarget', () => {
	test('a profile opened from a server targets that member', () => {
		expect(sheetTarget('UserProfile123', { userId: 'u', guildId: 'g' })).toEqual({
			kind: 'member',
			guildId: 'g',
			userId: 'u',
		});
		expect(sheetTarget('UserProfile123', { user: { id: 'u' }, guildId: 'g' })).toEqual({
			kind: 'member',
			guildId: 'g',
			userId: 'u',
		});
	});

	test('a profile opened outside a server has no target', () => {
		expect(sheetTarget('UserProfile123', { userId: 'u' })).toBeUndefined();
	});

	test('a server sheet reads its ID from the guild, the props or the key', () => {
		expect(sheetTarget('GuildActionSheet:1', { guild: { id: '2' } })).toEqual({
			kind: 'guild',
			guildId: '2',
		});
		expect(sheetTarget('GuildActionSheet:1', { guildId: '3' })).toEqual({
			kind: 'guild',
			guildId: '3',
		});
		expect(sheetTarget('GuildActionSheet:1', {})).toEqual({ kind: 'guild', guildId: '1' });
		expect(sheetTarget('GuildActionSheet:', {})).toBeUndefined();
	});

	test('channel sheets read the channel or its ID', () => {
		expect(sheetTarget('ChannelLongPressActionSheet', { channel: { id: 'c' } })).toEqual({
			kind: 'channel',
			channelId: 'c',
		});
		expect(sheetTarget('ChannelActionSheet', { channelId: 'd' })).toEqual({
			kind: 'channel',
			channelId: 'd',
		});
		expect(sheetTarget('ChannelLongPressActionSheet', {})).toBeUndefined();
	});

	test('other sheets are left alone', () => {
		expect(sheetTarget('MessageLongPressActionSheet', { channelId: 'c' })).toBeUndefined();
		expect(sheetTarget('ThreadLongPressActionSheet', { channelId: 'c' })).toBeUndefined();
		expect(sheetTarget('VoiceChannelActionSheet', { channelId: 'c' })).toBeUndefined();
		expect(sheetTarget('ChannelActionSheetFooter', { channelId: 'c' })).toBeUndefined();
	});
});

describe('asId', () => {
	test('accepts only non-empty strings', () => {
		expect(asId('1')).toBe('1');
		expect(asId('')).toBeUndefined();
		expect(asId(1)).toBeUndefined();
	});
});
