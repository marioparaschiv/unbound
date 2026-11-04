import { describe, expect, test } from 'bun:test';

import { closesProfile, contextMenuTarget } from '~/viewer/context-menus/targets';

const isGuild = (id: string) => id === 'g';
const profile = { key: 'UserProfile1', guildId: 'g', userId: 'u' };
const profileItems = [{ label: 'Copy User ID' }];

describe('contextMenuTarget', () => {
	test("a server's long-press menu targets the server", () => {
		expect(contextMenuTarget({ key: 'g', items: [] }, null, isGuild)).toEqual({
			kind: 'guild',
			guildId: 'g',
		});
	});

	test("a menu's own guild comes before its key", () => {
		expect(
			contextMenuTarget({ key: 'x', guild: { id: 'h' }, items: [] }, null, isGuild),
		).toEqual({ kind: 'guild', guildId: 'h' });
	});

	test('a user menu inside a server targets that member', () => {
		expect(
			contextMenuTarget({ user: { id: 'v' }, guildId: 'g', items: [] }, null, isGuild),
		).toEqual({ kind: 'member', guildId: 'g', userId: 'v' });
		expect(
			contextMenuTarget({ context: { userId: 'v', guildId: 'g' }, items: [] }, null, isGuild),
		).toEqual({ kind: 'member', guildId: 'g', userId: 'v' });
		expect(
			contextMenuTarget({ userId: 'v', key: 'g', items: [] }, profile, isGuild),
		).toBeUndefined();
	});

	test('a user menu outside a server is left alone', () => {
		expect(
			contextMenuTarget({ userId: 'v', items: profileItems }, null, isGuild),
		).toBeUndefined();
	});

	test('a menu for another user ignores the open profile', () => {
		expect(
			contextMenuTarget({ userId: 'v', items: profileItems }, profile, isGuild),
		).toBeUndefined();
		expect(
			contextMenuTarget({ user: { id: 'v' }, items: profileItems }, profile, isGuild),
		).toBeUndefined();
	});

	test('a menu for the open profile user targets that member', () => {
		expect(contextMenuTarget({ userId: 'u', items: [] }, profile, isGuild)).toEqual({
			kind: 'member',
			guildId: 'g',
			userId: 'u',
		});
	});

	test('a profile overflow menu without a user targets the open server profile', () => {
		const menu = { key: 'x', items: profileItems };

		expect(contextMenuTarget(menu, profile, isGuild)).toEqual({
			kind: 'member',
			guildId: 'g',
			userId: 'u',
		});
		expect(contextMenuTarget(menu, null, isGuild)).toBeUndefined();
	});

	test('other menus are left alone', () => {
		const menu = { key: 'x', items: [{ label: 'Mark As Read' }] };

		expect(contextMenuTarget(menu, profile, isGuild)).toBeUndefined();
	});
});

describe('closesProfile', () => {
	test('hiding the profile sheet or every sheet clears the record', () => {
		expect(closesProfile(profile, 'UserProfile1')).toBe(true);
		expect(closesProfile(profile, undefined)).toBe(true);
	});

	test('hiding another sheet keeps it', () => {
		expect(closesProfile(profile, 'ChannelLongPressActionSheet')).toBe(false);
		expect(closesProfile(null, 'UserProfile1')).toBe(false);
	});

	test('a stale profile no longer pairs with a later overflow menu', () => {
		const record = closesProfile(profile, 'UserProfile1') ? null : profile;

		expect(
			contextMenuTarget({ key: 'x', items: profileItems }, record, isGuild),
		).toBeUndefined();
	});
});
