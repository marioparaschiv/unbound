import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { ActionSheets, ContextMenus, hidden, opened, registerDiscord } from './helpers/discord';

type MenuItem = { label?: string; action?: () => void };
type Menu = { items: MenuItem[]; user?: { id: string }; guild?: { id: string; icon?: string } };

function open(menu: Menu) {
	ContextMenus.showContextMenu(menu);

	return menu.items;
}

beforeEach(async () => {
	registerDiscord();
	await startPlugin();
});

describe('the View rows in a context menu', () => {
	test("adds the images a user has to the user's menu", () => {
		expect(open({ items: [], user: { id: '1' } }).map((item) => item.label)).toEqual([
			'View Avatar',
			'View Banner',
		]);
	});

	test("adds the server icon to a server's menu", () => {
		expect(
			open({ items: [], guild: { id: '2', icon: 'ghi' } }).map((item) => item.label),
		).toEqual(['View Server Icon']);
	});

	test('adds a row once, however often the menu opens', () => {
		const menu: Menu = { items: [], user: { id: '1' } };

		open(menu);
		open(menu);

		expect(menu.items).toHaveLength(2);
	});

	test('opens the image full size and closes the menu when a row is pressed', () => {
		open({ items: [], user: { id: '1' } })[0]?.action?.();

		expect(hidden).toEqual(['menu']);
		expect(opened).toMatchObject([
			{
				initialSources: [
					{
						uri: 'https://cdn.discordapp.com/avatars/1/abc.webp?size=4096',
						width: 512,
						height: 512,
					},
				],
			},
		]);
	});
});

describe('the overflow menu of a profile', () => {
	// Discord's own messages, as it shows them in German.
	const german: Record<string, string> = { y5MwJy: 'Benutzernamen kopieren' };

	beforeEach(() => {
		metro.register({
			getLanguages: () => [],
			getSystemLocale: () => 'de',
			t: { y5MwJy: 'y5MwJy' },
			intl: { formatToPlainString: (id: string) => german[id] },
		});
		ActionSheets.openLazy(Promise.resolve({}), 'UserProfileActionSheet', { userId: '1' });
	});

	test('is recognized by Discord’s own wording, whatever the language', () => {
		expect(
			open({ items: [{ label: 'Benutzernamen kopieren' }] }).map((item) => item.label),
		).toEqual(['Benutzernamen kopieren', 'View Avatar', 'View Banner']);
	});

	test('leaves a menu with other rows alone', () => {
		expect(open({ items: [{ label: 'Something else' }] })).toHaveLength(1);
	});
});

describe('the overflow menu of a profile without Discord’s messages', () => {
	beforeEach(() => {
		metro.register({
			getLanguages: () => [],
			getSystemLocale: () => 'en',
			t: {},
			intl: { formatToPlainString: (id: string) => id },
		});
		ActionSheets.openLazy(Promise.resolve({}), 'UserProfileActionSheet', { userId: '1' });
	});

	test('is recognized by the English wording', () => {
		expect(open({ items: [{ label: 'Copy Username' }] }).map((item) => item.label)).toEqual([
			'Copy Username',
			'View Avatar',
			'View Banner',
		]);
	});
});
