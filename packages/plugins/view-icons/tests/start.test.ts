import { logs, pluginHolds, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

import { registerDiscord } from './helpers/discord';
import { selfTest } from '~/index';

describe('the plugin on start', () => {
	test('reports both patches in its self-test', async () => {
		registerDiscord();
		await startPlugin();

		expect(selfTest()).toEqual({ ok: true, detail: '2 features applied' });
	});

	test('keeps the action sheet patch when the context menu patch fails', async () => {
		registerDiscord({ brokenContextMenus: true });
		await startPlugin();

		expect(pluginHolds().join()).toContain('openLazy');
		expect(selfTest()).toMatchObject({ ok: false });
		expect(logs.entries.some(({ level }) => level === 'error')).toBe(true);
	});
});
