import { startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { ContextMenus, hidden, opened, registerDiscord } from './discord';

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
