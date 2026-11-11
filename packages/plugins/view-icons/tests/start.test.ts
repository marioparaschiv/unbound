import { logs, metro, pluginHolds, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

import { registerDiscord } from './helpers/discord';

describe('the plugin on start', () => {
	test('reports both patches in its self-test', async () => {
		registerDiscord();
		await startPlugin();

		expect(logs.entries.filter(({ level }) => level !== 'info')).toEqual([]);
	});

	// A throwing feature fails the whole start, which Unbound logs and reverts by disposing the plugin's scope.
	test('fails its start when the context menu patch throws', async () => {
		registerDiscord({ brokenContextMenus: true });

		await expect(startPlugin()).rejects.toThrow('The menu module changed shape.');
	});

	test('skips the context menus with one warning when Discord moved the module', async () => {
		registerDiscord();
		metro.markMissing('showContextMenu');
		await startPlugin();

		expect(pluginHolds().join()).toContain('openLazy');
		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['Context menus skipped: Discord moved ContextMenus, IconUtils, Media or Theme.'],
		});
	});
});
